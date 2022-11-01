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
            checkedFiles: [],
            currentType: "",
            dOMContentLoaded: false,
            files: [],
            message: '',
            messageClass: {alert:true,['alert-info']:true},
            ready: false,
            selectedFiles: [],
            translations: {},
            types: {},
            updating: false,
        };
    },
    computed: {
        isToCheck: function(){
            let isToCheck = (this.selectedFiles.length != 0 && (this.selectedFiles.filter((f)=>!this.checkedFiles.includes(f)).length > 0));
            return isToCheck;
        },
    },
    methods: {
        checkFiles: function(){
            
            let filesToCheck = this.selectedFiles.filter((f)=>!this.checkedFiles.includes(f));
            if (filesToCheck.length == 0){
                return
            }
            this.updating = true;
            this.message = this.t('checkingfiles')
            this.messageClass = {alert:true,['alert-info']:true};
            
            // 1. Create a new XMLHttpRequest object
            let xhr = new XMLHttpRequest();
            // 2. Configure it: GET-request
            xhr.open('POST',wiki.url(`?api/files/check`));
            // 3. Listen load
            xhr.onload = () =>{
                this.importFiles(xhr);
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
        convertStatusCodeToObject: function(code){
            return {
                isAssociatedToTag: (code % 2),
                isDeleted: ((code >> 1) % 2) ? true : (((code >> 2) % 2) ? null : false),
                isUsed: ((code >> 3) % 2) ? true : (((code >> 4) % 2) ? null : false),
                isLatestFileRevision: ((code >> 5) % 2) ? true : (((code >> 6) % 2) ? null : false),
            };
        },
        convertStatus: function (rawValue){
            return rawValue === 1
                ? true
                : (
                    rawValue === 0
                    ? false
                    : null
                );
        },
        formatFile: function(file){
            return {
                isDeleted: this.convertStatus(file.isDeleted),
                isUsed: this.convertStatus(file.isUsed),
                isLatestFileRevision: this.convertStatus(file.isLatestFileRevision),
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
        },
        filesToDisplay: function(files,currentType){
            let codeObject = this.convertStatusCodeToObject(currentType);
            return (currentType == "") ? files : files.filter((f)=>{
                return f.isDeleted==codeObject.isDeleted && 
                    f.isUsed==codeObject.isUsed &&
                    f.isLatestFileRevision==codeObject.isLatestFileRevision &&
                    (f.associatedPageTag.length > 0)==codeObject.isAssociatedToTag
            });
        },
        getStatusCode: function(file){
            return (file.associatedPageTag.length > 0)+
                2*(file.isDeleted === true)+
                (2**2)*(file.isDeleted === null)+
                (2**3)*(file.isUsed === true)+
                (2**4)*(file.isUsed===null)+
                (2**5)*(file.isLatestFileRevision===true)+
                (2**6)*(file.isLatestFileRevision===null);
        },
        getStatusLabelFromCode: function(code){
            let codeObject = this.convertStatusCodeToObject(code);
            let labels = [];
            if(codeObject.isAssociatedToTag){
                labels.push(this.t('statusassociatedtotag'))
            }
            if(codeObject.isDeleted){
                labels.push(this.t('statusisdeleted'))
            }
            if(codeObject.isUsed){
                labels.push(this.t('statusisused'))
            } else if(codeObject.isUsed === null){
                labels.push(this.t('statustocheck'))
            } else {
                labels.push(this.t('statusisnotused'))
            }            
            if(codeObject.isLatestFileRevision){
                labels.push(this.t('statusislastestfilerevision'))
            }
            return labels.join(' - ');
        },
        importFiles: function(xhr){
            if (xhr.status == 200){
                let responseDecoded = JSON.parse(xhr.response);
                if (responseDecoded && typeof responseDecoded == "object" && responseDecoded.hasOwnProperty('files') && Array.isArray(responseDecoded.files)){
                    let newFiles = responseDecoded.files.map((file)=>{
                        if (typeof file != "object" || 
                            !file.hasOwnProperty('isDeleted') ||
                            !file.hasOwnProperty('realname') ||
                            !['number','string'].includes(typeof file.isDeleted)){
                            return null;
                        }
                        let newFile = this.formatFile(file);
                        if (newFile.isUsed !== null && !this.checkedFiles.includes(file.realname)){
                            this.checkedFiles.push(file.realname)
                        }
                        return newFile;
                    }).filter((e)=>e !== null);
                    let newFilesRealNames = newFiles.map((f)=>f.realname)
                    let oldFiles = this.files.filter((f)=>!newFilesRealNames.includes(f.realname))
                    this.files = [...oldFiles,...newFiles];
                    if (newFiles.length > 0){
                        let newType = this.types;
                        newFiles.forEach((f)=>{
                            let statusCode = this.getStatusCode(f);
                            if (!newType.hasOwnProperty(statusCode)){
                                newType[statusCode] = this.getStatusLabelFromCode(statusCode);
                            }
                        });
                        this.types = newType
                    }
                }
            }
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
                this.importFiles(xhr);
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