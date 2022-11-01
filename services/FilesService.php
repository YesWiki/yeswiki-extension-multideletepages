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
    public const FILE_STATUS_CURRENTLY_USED = 0;
    public const FILE_STATUS_PREVIOUSLY_USED = 1;
    public const FILE_STATUS_NOT_USED = 2;
    public const FILE_STATUS_NO_ASSOCIATED_TAG = 3;
    public const FILE_STATUS_WITH_TAG_NOT_VERIFIED = 4;
    public const FILE_STATUS_PREVIOUS_REVISION_WITH_TAG_NOT_VERIFIED = 5;
    public const FILE_STATUS_TRASH_WITH_TAG_NOT_VERIFIED = 6;

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

    private function initAttach()
    {
        if (!class_exists('attach')) {
            include('tools/attach/libs/attach.lib.php');
        }
        $this->attach = new attach($this->wiki);
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
                    $newFormattedFiles = $file;
                    $newFormattedFiles['associatedPageTag'] = $tag;
                    $newFormattedFiles['pageTags'] = [];
                    $fullFileName = "{$file['name']}.{$file['ext']}";
                    // set status
                    if ($mode == "trash") {
                        $newFormattedFiles['status'] = self::FILE_STATUS_TRASH_WITH_TAG_NOT_VERIFIED;
                    } elseif (!isset($previousFilesNames[$fullFileName])) {
                        $previousFilesNames[$fullFileName] = $file;
                        $newFormattedFiles['status'] = self::FILE_STATUS_WITH_TAG_NOT_VERIFIED;
                    } elseif ($previousFilesNames[$fullFileName]['dateupload'] < $file['dateupload']) {
                        foreach ($formattedFiles as $idx => $otherFile) {
                            if ($otherFile['associatedPageTag'] == $tag &&
                                $otherFile['name'] == $file['name'] &&
                                $otherFile['status'] == self::FILE_STATUS_WITH_TAG_NOT_VERIFIED
                            ) {
                                $formattedFiles[$idx]['status'] = self::FILE_STATUS_PREVIOUS_REVISION_WITH_TAG_NOT_VERIFIED;
                            }
                        }
                        $previousFilesNames[$fullFileName] = $file;
                        $newFormattedFiles['status'] = self::FILE_STATUS_WITH_TAG_NOT_VERIFIED;
                    } else {
                        $newFormattedFiles['status'] = self::FILE_STATUS_PREVIOUS_REVISION_WITH_TAG_NOT_VERIFIED;
                    }
                    $formattedFiles[] = $newFormattedFiles;
                }
            }
        }
        foreach ($filesWithoutTagInName as $file) {
            $newFormattedFiles = $file;
            $newFormattedFiles['associatedPageTag'] = "";
            $newFormattedFiles['pageTags'] = $file['pageTags'];
            $newFormattedFiles['status'] = (empty($file['pageTags']))
                ? self::FILE_STATUS_NOT_USED
                : self::FILE_STATUS_CURRENTLY_USED ;
            $formattedFiles[] = $newFormattedFiles;
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
            $filesWithoutTagInName[$idx]['pageTags'] = $this->searchPagesWithFile($pages, $file['realname']);
        }
        return $filesWithoutTagInName;
    }

    /**
     * search files in pages
     * @param array $pages (from PageManager::getAll())
     * @param string $fileName
     * @return array $pagesTag
     */
    protected function searchPagesWithFile(array $pages, string $fileName): array
    {
        $foundPagesTags = [];
        foreach ($pages as $page) {
            $quotedFileName = preg_quote("file=\"$fileName\"", '/');
            // page content
            if (preg_match("/{{attach.*$quotedFileName/", $page['body'])) {
                $foundPagesTags[] = $page['tag'];
            } else {
                $quotedattach = preg_quote(json_encode("{{attach"), '/');
                $quotedFileName = preg_quote(json_encode("file=\"$fileName\""), '/');
                // textarea field content
                if (preg_match("/$quotedattach.*$quotedFileName/", $page['body'])) {
                    $foundPagesTags[] = $page['tag'];
                } else {
                    $quotedFileName = preg_quote("\":\"$fileName\"", '/');
                    // image ou file field content
                    if (preg_match("/$quotedFileName/", $page['body'])) {
                        $foundPagesTags[] = $page['tag'];
                    }
                }
            }
        }
        return $foundPagesTags;
    }
}
