<?php

/*
 * This file is part of the YesWiki Extension multideletepages.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace YesWiki\Multideletepages\Controller;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use YesWiki\Core\ApiResponse;
use YesWiki\Core\YesWikiController;
use YesWiki\Multideletepages\Service\FilesService;

class ApiController extends YesWikiController
{
    /**
     * @Route("/api/files",methods={"GET"}, options={"acl":{"public","@admins"}},priority=2)
     */
    public function getFiles()
    {
        $this->denyAccessUnlessAdmin();
        $filesService = $this->getService(FilesService::class);
        $files = $filesService->getFiles();
        return new ApiResponse(['files'=>$files]);
    }

    /**
     * @Route("/api/files/check",methods={"POST"}, options={"acl":{"public","@admins"}},priority=2)
     */
    public function checkFiles()
    {
        $this->denyAccessUnlessAdmin();
        $filesService = $this->getService(FilesService::class);
        $files = $filesService->checkFiles($_POST);
        return new ApiResponse(['files'=>$files]);
    }

    /**
     * @Route("/api/files/movetotrash",methods={"POST"}, options={"acl":{"public","@admins"}},priority=2)
     */
    public function moveFilesToTrash()
    {
        $this->denyAccessUnlessAdmin();
        $filesService = $this->getService(FilesService::class);
        list('files'=>$files, 'removedFiles'=>$removedFiles) = $filesService->moveFilesToTrash($_POST);
        return new ApiResponse(['files'=>$files,'removedFiles'=>$removedFiles]);
    }

    /**
     * @Route("/api/files/restore",methods={"POST"}, options={"acl":{"public","@admins"}},priority=2)
     */
    public function restoreFiles()
    {
        $this->denyAccessUnlessAdmin();
        $filesService = $this->getService(FilesService::class);
        list('files'=>$files, 'removedFiles'=>$removedFiles) = $filesService->restoreFiles($_POST);
        return new ApiResponse(['files'=>$files,'removedFiles'=>$removedFiles]);
    }

    /**
     * @Route("/api/files/delete",methods={"POST"}, options={"acl":{"public","@admins"}},priority=2)
     */
    public function deleteFiles()
    {
        $this->denyAccessUnlessAdmin();
        $filesService = $this->getService(FilesService::class);
        list('files'=>$files, 'removedFiles'=>$removedFiles) = $filesService->restoreFiles($_POST, true);
        return new ApiResponse(['files'=>$files,'removedFiles'=>$removedFiles]);
    }
}
