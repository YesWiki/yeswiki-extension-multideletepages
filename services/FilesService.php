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
use YesWiki\Bazar\Service\EntryManager;
use YesWiki\Core\Service\PageManager;
use YesWiki\Wiki;

class FilesService
{
    public const EXCLUDED_FILENAMES = ["README.md"];
    public const STATUS_UNKNOWN = 2;
    public const STATUS_FALSE = 0;
    public const STATUS_TRUE = 1;

    protected $attach;
    protected $entryManager;
    protected $pageManager;
    protected $wiki;

    public function __construct(
        EntryManager $entryManager,
        PageManager $pageManager,
        Wiki $wiki,
    ) {
        $this->entryManager = $entryManager;
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
        $entriesTags = $this->entryManager->getAllEntriesTags();
        $files = $this->getFilesFromPages($pages, false);
        $trashFiles = $this->getFilesFromPages($pages, true);
        $filesWithoutTagInName = $this->getFilesWithoutTagInName($pages, $entriesTags, $files, $trashFiles);
        return $this->formatFiles($files, $trashFiles, $filesWithoutTagInName);
    }

    public function checkFiles(array $data, bool $allowEmptyTag = false): array
    {
        $files = $this->getFilesFromData($data, $allowEmptyTag);
        $newFiles = [];
        $pages = $this->pageManager->getAll();
        $entriesTags = $this->entryManager->getAllEntriesTags();
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
                    $formattedFile['isDeleted'] = $this->isFileDeleted($file);
                    $formattedFile['pageTags'] = $this->searchPagesWithFile($pages, $entriesTags, $formattedFile);
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

    public function moveFilesToTrash(array $data): array
    {
        $uploadDirName =  $this->attach->GetUploadPath();
        $rawFiles = $this->getFilesFromData($data, true);
        $files = [];
        $removedFiles = [];
        $newFilesNames = [];
        $currentTag = $this->wiki->tag;

        try {
            foreach ($rawFiles as $rawFile) {
                $this->attach->fmDelete($rawFile['realname']);
                $deletedFiles = glob("$uploadDirName/{$rawFile['realname']}trash*");
                if (count($deletedFiles)>0) {
                    $newRealname = basename($deletedFiles[0]);
                    if (file_exists("$uploadDirName/$newRealname")) {
                        $removedFiles[] = $rawFile['realname'];
                        $newFilesNames[] = [
                            'realname' => $newRealname,
                            'tag' => $rawFile['tag'] ?? ""
                        ];
                    }
                }
            }
            $files = $this->checkFiles([
                'files'=> $newFilesNames
            ], true);
        } catch (Throwable $th) {
            $this->wiki->tag = $currentTag;
            throw $th;
        }
        $this->wiki->tag = $currentTag;

        return compact(['files','removedFiles']);
    }

    public function restoreFiles(array $data, bool $eraseMode  = false): array
    {
        $uploadDirName =  $this->attach->GetUploadPath();
        $rawFiles = $this->getFilesFromData($data, true);
        $files = [];
        $removedFiles = [];
        $newFilesNames = [];
        $currentTag = $this->wiki->tag;
        $previousGetSetted = array_key_exists('file', $_GET);
        $previousGet = $_GET['file'] ?? '';

        try {
            foreach ($rawFiles as $rawFile) {
                $_GET['file'] = basename($rawFile['realname']);
                if (!$eraseMode) {
                    $this->attach->fmRestore();
                    $newFilename = preg_replace("/trash\\d{14}$/", "", $rawFile['realname']);
                    if (file_exists("$uploadDirName/$newFilename")) {
                        $removedFiles[] = $rawFile['realname'];
                        $newFilesNames[] = [
                            'realname' => $newFilename,
                            'tag' => $rawFile['tag'] ?? ""
                        ];
                    }
                } else {
                    $this->attach->fmErase();
                    if (!file_exists("$uploadDirName/{$rawFile['realname']}")) {
                        $removedFiles[] = $rawFile['realname'];
                    }
                }
            }
            $files = $this->checkFiles([
                'files'=> $newFilesNames
            ], true);
        } catch (Throwable $th) {
            $this->wiki->tag = $currentTag;
            if ($previousGetSetted) {
                $_GET['file'] = $previousGet;
            } else {
                unset($_GET['file']);
            }
            throw $th;
        }
        $this->wiki->tag = $currentTag;
        if ($previousGetSetted) {
            $_GET['file'] = $previousGet;
        } else {
            unset($_GET['file']);
        }

        return compact(['files','removedFiles']);
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

    protected function getFilesFromData(array $data, bool $allowEmptyTag = false): array
    {
        return (isset($data['files']) && is_array($data['files']))
            ? array_filter($data['files'], function ($f) use ($allowEmptyTag) {
                return is_array($f) && !empty($f['realname']) && is_string($f['realname'])
                    && ($allowEmptyTag || !empty($f['tag'])) && is_string($f['tag']);
            })
            : [];
    }

    protected function isFileDeleted($file): int
    {
        return (empty($file['ext']) || empty($file['trashdate']))
            ? (
                preg_match("/\.[a-z0-9]+trash\d{14}/", $file['realname'])
                ? self::STATUS_TRUE
                : self::STATUS_UNKNOWN
            )
            : (
                !in_array($file['trashdate'], [$file['ext'],$file['ext'].'_'])
                    ? self::STATUS_TRUE
                    : self::STATUS_FALSE
            );
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
            $formattedFile['isDeleted'] = $this->isFileDeleted($file);
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
     * @param array $entriesTags (from EntryManager::getAllEntriesTags())
     * @param array $files
     * @param array $trashFiles
     * @return array $filesWithoutTagInName
     */
    protected function getFilesWithoutTagInName(array $pages, array $entriesTags, array $files, array $trashFiles): array
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
            $filesWithoutTagInName[$idx]['pageTags'] = $this->searchPagesWithFile($pages, $entriesTags, $file);
        }
        return $filesWithoutTagInName;
    }

    /**
     * search files in pages
     * @param array $pages (from PageManager::getAll())
     * @param array $entriesTags (from EntryManager::getAllEntriesTags())
     * @param array $file
     * @return array $pagesTag
     */
    protected function searchPagesWithFile(array $pages, array $entriesTags, array $file): array
    {
        $uploadDirName =  $this->attach->GetUploadPath();
        $fullfilename = (!empty($file['ext']) && !empty($file['name'])) ? ($file['name'].'.'.$file['ext']) : $file['realname'];
        $notDeletedRealName = $this->isFileDeleted($file) === self::STATUS_TRUE
            ? (
                (
                    !empty($file['associatedPageTag']) &&
                    strpos($file['realname'], $file['associatedPageTag'].'_') === 0 &&
                    strpos($file['name'], $file['associatedPageTag'].'_') === false
                ) ? "{$file['associatedPageTag']}_" : ""
            )
                . "{$file['name']}_{$file['datepage']}_{$file['dateupload']}.{$file['ext']}"
                . (strpos($file['realname'], ".{$file['ext']}_trash") !== false ? "_" : "")
            : $file['realname'];
        $tests = [
            'same tag' => [
                'page' => '{{(attach|section)[^}]*'.preg_quote("file=\"$fullfilename\"", '/'),
                'entry' => [
                    'textarea - wikimode' => preg_quote(substr(json_encode("{{attach"), 1, -1), '/').'[^}]*'.preg_quote(substr(json_encode("file=\"$fullfilename\""), 1, -1), '/'),
                ]
            ],
            'entry' => [
                'textarea - htmlmode' => preg_quote(substr(json_encode("src=\"$uploadDirName/$notDeletedRealName\""), 1, -1), '/'),
                'image or file field' => preg_quote("\":\"$notDeletedRealName\"", '/'),
            ],
            'page' => []
        ];
        if (!empty($file['associatedPageTag'])) {
            $tests['page'][] = '{{(attach|section)[^}]*'.preg_quote("file=\"{$file['associatedPageTag']}/$fullfilename\"", '/');
            $tests['entry']['textarea - wikimode'] = preg_quote(substr(json_encode("{{attach"), 1, -1), '/').'[^}]*'.preg_quote(substr(json_encode("file=\"{$file['associatedPageTag']}/$fullfilename\""), 1, -1), '/');
        }
        $foundPagesTags = [];
        foreach ($pages as $page) {
            $this->testPage($tests, $page, $foundPagesTags, $file, $entriesTags);
        }
        if (empty($foundPagesTags) && !empty($file['associatedPageTag'])) {
            $revisions = $this->pageManager->getRevisions($file['associatedPageTag']);
            if (!empty($revisions)) {
                foreach ($revisions as $revision) {
                    $page = $this->pageManager->getById($revision['id']);
                    if (!empty($page)) {
                        $this->testPage($tests, $page, $foundPagesTags, $file, $entriesTags);
                    }
                }
            }
        }
        return $foundPagesTags;
    }

    private function testPage(array $tests, array $page, array &$foundPagesTags, array $file, array $entriesTags)
    {
        $pageTime = $this->attach->convertDate($page['time']);
        if (empty($file['datepage'])|| ($file['datepage'] <= $pageTime)) {
            $localTests = [];
            if (in_array($page['tag'], $entriesTags)) {
                foreach ($tests['entry'] as $test) {
                    $localTests[] = $test;
                }
                if (!empty($file['associatedPageTag']) && $file['associatedPageTag'] == $page['tag']) {
                    foreach ($tests['same tag']['entry'] as $test) {
                        $localTests[] = $test;
                    }
                }
            } else {
                foreach ($tests['page'] as $test) {
                    $localTests[] = $test;
                }
                if (!empty($file['associatedPageTag']) && $file['associatedPageTag'] == $page['tag']) {
                    foreach ($tests['same tag']['page'] as $test) {
                        $localTests[] = $test;
                    }
                }
            }
            $found = false;
            foreach ($localTests as $test) {
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
