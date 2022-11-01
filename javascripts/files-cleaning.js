/*
 * This file is part of the YesWiki Extension multideletepages.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import Translations from './components/Translations.js'
import FileCleaningTable from './components/FileCleaningTable.js'
import SpinnerLoader from '../../bazar/presentation/javascripts/components/SpinnerLoader.js'

let rootsElements = ['.files-cleaning-container'];
let isVueJS3 = (typeof Vue.createApp == "function");

let appParams = {
    components: { Translations, FileCleaningTable, SpinnerLoader },
    data: function() {
        return {
            currentType: "",
            dOMContentLoaded: false,
            files: [],
            message: '',
            messageClass: {alert:true,['alert-info']:true},
            ready: false,
            selectedFiles: [],
            sourceStatus: ['zero','one','two','three','four','five','six'],
            translations: {},
            types: {},
            updating: false,
        };
    },
    methods: {
        filesToDisplay: function(files,currentType){
            return (currentType == "") ? files : files.filter((f)=>String(f.status)==currentType);
        },
        isObject: function(objValue){
            return objValue && typeof objValue === 'object' && objValue.constructor === Object;
        },
        isTypesEmpty: function(types){
            return Object.keys(types).length == 0;
        },
        loadFilesAsync: function(){
            this.message = this.t('loadingfiles')
            this.messageClass = {alert:true,['alert-info']:true};
            this.updating = true;
            this.ready = true;
            
            // 1. Create a new XMLHttpRequest object
            let xhr = new XMLHttpRequest();
            // 2. Configure it: GET-request
            xhr.open('GET',wiki.url(`?api/files`));
            // 3. Listen load
            xhr.onload = () =>{
                if (xhr.status == 200){
                    let responseDecoded = JSON.parse(xhr.response);
                    if (responseDecoded && typeof responseDecoded == "object" && responseDecoded.hasOwnProperty('files') && Array.isArray(responseDecoded.files)){
                        this.files = responseDecoded.files.map((file)=>{
                            if (typeof file != "object" || 
                                !file.hasOwnProperty('status') ||
                                !file.hasOwnProperty('realname') ||
                                typeof file.status != "number" ||
                                file.status < 0 ||
                                file.status > 6 ){
                                return null;
                            }
                            return {
                                status: file.status,
                                name: (file.hasOwnProperty('name') && file.hasOwnProperty('ext'))
                                     ? `${file.name}.${file.ext}`
                                     : file.realname,
                                realname: file.realname,
                                uploadtime: file.dateupload || "",
                                pageversion: file.datepage || "",
                                pagetags: [
                                    ...((typeof file.associatedPageTag == "string" && file.associatedPageTag.length > 0) ? [file.associatedPageTag]:[]),
                                    ...((file.pageTags && Array.isArray(file.pageTags)) ? file.pageTags:[])
                                ],
                                associatedPageTag: (typeof file.associatedPageTag == "string") ? file.associatedPageTag : ""
                            };
                        }).filter((e)=>e !== null);
                        if (this.files.length > 0){
                            let newType = this.types;
                            this.files.forEach((f)=>{
                                if (this.sourceStatus[f.status] != undefined && !newType.hasOwnProperty(f.status)){
                                    newType[f.status] = this.t('status'+this.sourceStatus[f.status]);
                                }
                            });
                            this.types = newType
                        }
                    }
                }
                this.updating = false;
                this.message = "";
            }
            // 4 .listen error
            xhr.onerror = () => {
                this.updating = false;
                this.message = "";
            };
            // 5. Send the request over the network
            xhr.send();
        },
        t: function(text, replacements = {}){
            if (this.translations.hasOwnProperty(text)){
                let message = this.translations[text]
                for (var key in replacements) {
                    while (message.includes(`{${key}}`)){
                        message = message.replace(`{${key}}`,replacements[key])
                    }
                }
                return message;
            } else {
                return "";
            }
        },
    },
    mounted(){
        $(isVueJS3 ? this.$el.parentNode : this.$el).on('dblclick',function(e) {
          return false;
        });
        document.addEventListener('DOMContentLoaded', () => {
            this.dOMContentLoaded = true;
        });
        this.loadFilesAsync();
    },
};

if (isVueJS3){
    let app = Vue.createApp(appParams);
    app.config.globalProperties.wiki = wiki;
    app.config.globalProperties._t = _t;
    rootsElements.forEach(elem => {
        app.mount(elem);
    });
} else {
    Vue.prototype.wiki = wiki;
    Vue.prototype._t = _t;
    rootsElements.forEach(elem => {
        new Vue({
            ...{el:elem},
            ...appParams
        });
    });
}