<?php

/*
 * This file is part of the YesWiki Extension multideletepages.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace YesWiki\Multideletepages\Service;

use attach;
use Throwable;
use YesWiki\Core\Service\PageManager;
use YesWiki\Wiki;

class FilesService
{
    public const EXCLUDED_FILENAMES = ["README.md"];
    public const STATUS_UNKNOWN = 2;
    public const STATUS_FALSE = 0;
    public const STATUS_TRUE = 1;

    protected $attach;
    protected $pageManager;
    protected $wiki;

    public function __construct(
        PageManager $pageManager,
        Wiki $wiki,
    ) {
        $this->pageManager = $pageManager;
        $this->wiki = $wiki;
        $this->initAttach();
    }

    public function getFiles(): array
    {
        $pages = $this->pageManager->getAll();
        if (empty($pages)) {
            return [];
        }
        $files = $this->getFilesFromPages($pages, false);
        $trashFiles = $this->getFilesFromPages($pages, true);
        $filesWithoutTagInName = $this->getFilesWithoutTagInName($pages, $files, $trashFiles);
        return $this->formatFiles($files, $trashFiles, $filesWithoutTagInName);
    }

    public function checkFiles(array $data): array
    {
        $files = (isset($data['files']) && is_array($data['files']))
            ? array_filter($data['files'], function ($f) {
                return is_array($f) && !empty($f['realname']) && is_string($f['realname'])
                    && !empty($f['tag']) && is_string($f['tag']);
            })
            : [];
        $newFiles = [];
        $pages = $this->pageManager->getAll();
        if (!empty($pages)) {
            $uploadDirName =  $this->attach->GetUploadPath();
            $currentTag = $this->wiki->tag;
            try {
                foreach ($files as $rawFile) {
                    $tag = $rawFile['tag'];
                    $this->wiki->tag = $tag;
                    $file = $this->attach->decodeLongFilename($uploadDirName . '/' . $rawFile['realname']);
                    $formattedFile = $this->appendDefaultFormattedData($file);
                    $formattedFile['associatedPageTag'] = $tag;
                    $formattedFile['isDeleted'] = !in_array($file['trashdate'], [$file['ext'],$file['ext'].'_'])
                        ? self::STATUS_TRUE
                        : self::STATUS_FALSE ;
                    $formattedFile['pageTags'] = $this->searchPagesWithFile($pages, $formattedFile);
                    $formattedFile['isUsed'] = !empty($formattedFile['pageTags'])
                        ? self::STATUS_TRUE
                        : self::STATUS_FALSE ;
                    $newFiles[] = $formattedFile;
                }
            } catch (Throwable $th) {
                $this->wiki->tag = $currentTag;
                throw $th;
            }
            $this->wiki->tag = $currentTag;
        }
        return $newFiles;
    }

    private function initAttach()
    {
        if (!class_exists('attach')) {
            include('tools/attach/libs/attach.lib.php');
        }
        $this->attach = new attach($this->wiki);
    }

    protected function appendDefaultFormattedData(array $file): array
    {
        $file['associatedPageTag'] = "";
        $file['pageTags'] = [];
        $file['isDeleted'] = self::STATUS_UNKNOWN;
        $file['isUsed'] = self::STATUS_UNKNOWN;
        $file['isLatestFileRevision'] = self::STATUS_UNKNOWN;
        return $file;
    }

    /**
     * format files
     * @param array $files
     * @param array $trashFiles
     * @param array $filesWithoutTagInName
     * @return array $formattedFiles
     */
    protected function formatFiles(array $files, array $trashFiles, array $filesWithoutTagInName): array
    {
        $previousFilesNames = [];
        $formattedFiles = [];
        foreach ([
            '' => $files,
            'trash' =>$trashFiles
        ] as $mode => $arrayFiles) {
            foreach ($arrayFiles as $tag => $pageFiles) {
                foreach ($pageFiles as $file) {
                    $formattedFile = $this->appendDefaultFormattedData($file);
                    $formattedFile['associatedPageTag'] = $tag;
                    $formattedFile['isDeleted'] = ($mode == "trash") ? self::STATUS_TRUE : self::STATUS_FALSE;
                    $fullFileName = "{$file['name']}.{$file['ext']}";
                    // set status
                    if ($mode != "trash") {
                        if (!isset($previousFilesNames[$fullFileName])) {
                            $previousFilesNames[$fullFileName] = $file;
                            $formattedFile['isLatestFileRevision'] = self::STATUS_TRUE;
                        } elseif ($previousFilesNames[$fullFileName]['dateupload'] < $file['dateupload']) {
                            foreach ($formattedFiles as $idx => $otherFile) {
                                if ($otherFile['associatedPageTag'] == $tag &&
                                    $otherFile['name'] == $file['name'] &&
                                    $otherFile['isLatestFileRevision'] == self::STATUS_TRUE
                                ) {
                                    $formattedFiles[$idx]['isLatestFileRevision'] = self::STATUS_FALSE;
                                }
                            }
                            $previousFilesNames[$fullFileName] = $file;
                            $formattedFile['isLatestFileRevision'] = self::STATUS_TRUE;
                        } else {
                            $formattedFile['isLatestFileRevision'] = self::STATUS_FALSE;
                        }
                    }
                    $formattedFiles[] = $formattedFile;
                }
            }
        }
        foreach ($filesWithoutTagInName as $file) {
            $formattedFile = $this->appendDefaultFormattedData($file);
            $formattedFile['pageTags'] = $file['pageTags'];
            $formattedFile['isDeleted'] = self::STATUS_FALSE;
            $formattedFile['isUsed'] = (empty($file['pageTags']))
                ? self::STATUS_FALSE
                : self::STATUS_TRUE ;
            $formattedFiles[] = $formattedFile;
        }
        return $formattedFiles;
    }

    /**
     * get files from pages using attach lib
     * @param array $pages (from PageManager::getAll())
     * @param bool $fromTrash
     * @return array $files = [$tag => [
     *  'realname'=>string,
     *  'size'=> number,
     *  'dirname'=> string,
     *  'name'=> string, // optionnal
     *  'datepage'=> string, // optionnal
     *  'dateupload'=> string, // optionnal
     *  'trashdate'=> string, // optionnal
     *  'ext'=> string, // optionnal
     * ],$tag2 =>[...]]
     * @throws Throwable
     */
    protected function getFilesFromPages(array $pages, bool $fromTrash = false): array
    {
        $currentTag = $this->wiki->tag;
        $files = [];
        try {
            foreach ($pages as $page) {
                if (!empty($page['tag'])) {
                    $this->wiki->tag = $page['tag'];
                    $rawFiles = $this->attach->fmGetFiles($fromTrash);
                    if (!empty($rawFiles)) {
                        $files[$this->wiki->tag] = $rawFiles;
                    }
                }
            }
        } catch (Throwable $th) {
            $this->wiki->tag = $currentTag;
            throw $th;
        }
        $this->wiki->tag = $currentTag;
        return $files;
    }

    /**
     * Get files without tag in name
     * @param array $pages (from PageManager::getAll())
     * @param array $files
     * @param array $trashFiles
     * @return array $filesWithoutTagInName
     */
    protected function getFilesWithoutTagInName(array $pages, array $files, array $trashFiles): array
    {
        $filesWithoutTagInName = [];
        $realnameFilesWithTag = [];
        foreach ($files as $tag => $pagefiles) {
            foreach ($pagefiles as $file) {
                $realnameFilesWithTag[] = $file['realname'];
            }
        }
        foreach ($trashFiles as $tag => $pagefiles) {
            foreach ($pagefiles as $file) {
                $realnameFilesWithTag[] = $file['realname'];
            }
        }
        $uploadDirName =  $this->attach->GetUploadPath();
        $allFiles = $this->attach->searchFiles('`^.*$`', $uploadDirName);
        foreach ($allFiles as $file) {
            if (is_file("$uploadDirName/{$file['realname']}") && !in_array($file['realname'], self::EXCLUDED_FILENAMES) && !in_array($file['realname'], $realnameFilesWithTag)) {
                $filesWithoutTagInName[] = $file;
            }
        }
        foreach ($filesWithoutTagInName as $idx => $file) {
            $filesWithoutTagInName[$idx]['pageTags'] = $this->searchPagesWithFile($pages, $file);
        }
        return $filesWithoutTagInName;
    }

    /**
     * search files in pages
     * @param array $pages (from PageManager::getAll())
     * @param array $file
     * @return array $pagesTag
     */
    protected function searchPagesWithFile(array $pages, array $file): array
    {
        $uploadDirName =  $this->attach->GetUploadPath();
        $fullfilename = (!empty($file['ext']) && !empty($file['name'])) ? ($file['name'].'.'.$file['ext']) : $file['realname'];
        $tests = [
            'page content' => '{{(attach|section)[^}]*'.preg_quote("file=\"$fullfilename\"", '/'),
            'textarea field content wikimode' => preg_quote(substr(json_encode("{{attach"), 1, -1), '/').'[^}]*'.preg_quote(substr(json_encode("file=\"$fullfilename\""), 1, -1), '/'),
            'textarea field content html mode' => preg_quote(substr(json_encode("src=\"$uploadDirName/{$file['realname']}\""), 1, -1), '/'),
            'image ou file field content' => preg_quote("\":\"{$file['realname']}\"", '/'),
        ];
        $foundPagesTags = [];
        foreach ($pages as $page) {
            $this->testPage($tests, $page, $foundPagesTags, $file);
        }
        if (empty($foundPagesTags) && !empty($file['associatedPageTag'])) {
            $revisions = $this->pageManager->getRevisions($file['associatedPageTag']);
            if (!empty($revisions)) {
                foreach ($revisions as $revision) {
                    $page = $this->pageManager->getById($revision['id']);
                    if (!empty($page)) {
                        $this->testPage($tests, $page, $foundPagesTags, $file);
                    }
                }
            }
        }
        return $foundPagesTags;
    }

    private function testPage(array $tests, array $page, array &$foundPagesTags, array $file)
    {
        $pageTime = $this->attach->convertDate($page['time']);
        if (empty($file['datepage'])|| ($file['datepage'] <= $pageTime)) {
            $found = false;
            foreach ($tests as $test) {
                if (!$found && preg_match("/.*$test.*/", $page['body'])) {
                    $found = true;
                    if (!isset($foundPagesTags[$page['tag']])) {
                        $foundPagesTags[$page['tag']] = [];
                    }
                    $foundPagesTags[$page['tag']][] = [
                        'time' => $page['time'],
                        'latest' => $page['latest'] == "Y",
                    ];
                }
            }
        }
    }
}
