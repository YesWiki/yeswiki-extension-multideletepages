/*
 * This file is part of the YesWiki Extension multideletepages.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export default {
    methods: {
        loadTranslationsIntoRoot: function(){
            let translations = {};
            for (const name in this.$scopedSlots) {
                if (name != "default" && typeof this.$scopedSlots[name] == "function"){
                    let slot = (this.$scopedSlots[name])();
                    if (typeof slot == "object"){
                        translations[name] = slot[0].text;
                    }
                }
            }
            this.$root.translations = translations;
        }
    },
    mounted(){
        this.loadTranslationsIntoRoot();
    },
    template: `
      <div></div>
    `
  }