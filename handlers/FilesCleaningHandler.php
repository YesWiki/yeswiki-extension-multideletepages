<?php

/*
 * This file is part of the YesWiki Extension multideletepages.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace YesWiki\Multideletepages;

use YesWiki\Core\YesWikiHandler;

class FilesCleaningHandler extends YesWikiHandler
{
    public function run()
    {
        if (!$this->wiki->UserIsAdmin()) {
            return $this->renderInSquelette('@templates/alert-message.twig', [
                'type'=>'danger',
                'message'=> get_class($this)." : " . _t('BAZ_NEED_ADMIN_RIGHTS')
            ]) ;
        }

        return $this->renderInSquelette("@multideletepages/files-cleaning.twig", []);
    }
}
