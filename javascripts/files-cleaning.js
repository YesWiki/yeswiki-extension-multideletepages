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
            visibleFiles: [],
        };
    },
    computed: {
        canDelete: function(){
            let fnameToRestore = this.filesToRestore.map((f)=>f.realname);
            return this.canBeRestored && this.selectedFiles.every((fname)=>fnameToRestore.includes(fname));
        },
        filesToMoveToTrash: function(){
            return this.selectedFiles.length == 0 ? [] : this.filesToDisplay(this.files,this.currentType).filter((f)=>{
                return this.selectedFiles.includes(f.realname) && this.visibleFiles.includes(f.realname) && this.checkedFiles.includes(f.realname) && !f.isDeleted;
            }).map((f)=>{
                return {realname:f.realname,tag:f.associatedPageTag ||""}
            })
        },
        filesToCheck: function(){
            return this.selectedFiles.length == 0 ? [] : this.filesToDisplay(this.files,this.currentType).filter((f)=>{
                return this.selectedFiles.includes(f.realname) && this.visibleFiles.includes(f.realname) && !this.checkedFiles.includes(f.realname) && f.associatedPageTag.length > 0;
            }).map((f)=>{
                return {realname:f.realname,tag:f.associatedPageTag}
            })
        },
        filesToRestore: function(){
            return this.selectedFiles.length == 0 ? [] : this.filesToDisplay(this.files,this.currentType).filter((f)=>{
                return this.selectedFiles.includes(f.realname) && this.visibleFiles.includes(f.realname) && this.checkedFiles.includes(f.realname) && f.isDeleted;
            }).map((f)=>{
                return {realname:f.realname,tag:f.associatedPageTag || ""}
            })
        },
        isToCheck: function(){
            return this.filesToCheck.length > 0;
        },
        canBeMovedToTrash: function(){
            return this.selectedFiles.length != 0 && !this.isToCheck && this.filesToMoveToTrash.length > 0;
        },
        canBeRestored: function(){
            return this.selectedFiles.length != 0 && !this.isToCheck && !this.canBeMovedToTrash && this.filesToRestore.length > 0;
        },
    },
    methods: {
        checkFiles: function(){
            let dataToSend = {
                files: this.filesToCheck
            };
            
            this.loadAsyncCommon({
                message: this.t('checkingfiles'),
                class: 'alert-info',
                method: 'POST',
                url: `?api/files/check`,
                removeFiles: false,
                data: this.prepareFormData(dataToSend)
            });
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
        deleteFiles: function(){
            let dataToSend = {
                files: this.filesToRestore
            };
            
            this.loadAsyncCommon({
                message: this.t('deletingfiles'),
                class: 'alert-danger',
                method: 'POST',
                url: `?api/files/delete`,
                removeFiles: true,
                data: this.prepareFormData(dataToSend)
            });
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
                pagetags: (typeof file.pageTags == "object") ? file.pageTags :{},
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
                    let oldFilesRealNames = this.files.map((f)=>f.realname)
                    let filesToAppend = [];
                    let idxToFollow = [];
                    newFiles.forEach((f)=>{
                        let indexInFiles = oldFilesRealNames.findIndex((e)=>(e==f.realname))
                        if (indexInFiles == -1){
                            // new file
                            filesToAppend.push(f);
                        } else {
                            if (f.isLatestFileRevision === null){
                                f.isLatestFileRevision = this.files[indexInFiles].isLatestFileRevision
                            }
                            idxToFollow.push(indexInFiles);
                            this.$set(this.files,indexInFiles,f)
                        }
                    });
                    this.files = [...this.files,...filesToAppend];
                    if (newFiles.length > 0){
                        this.updateTypes();
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
        loadAsyncCommon: function(options){
            this.updating = true;
            this.ready = true;
            this.message = options.message
            this.messageClass = {alert:true,[options.class]:true};
            
            // 1. Create a new XMLHttpRequest object
            let xhr = new XMLHttpRequest();
            // 2. Configure it: GET-request
            xhr.open(options.method,wiki.url(options.url));
            // 3. Listen load
            xhr.onload = () =>{
                if (options.removeFiles){
                    this.removeFiles(xhr);
                }
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
            if (options.data){
                xhr.send(options.data);
            } else {
                xhr.send();
            }

        },
        loadFilesAsync: function(){
            this.loadAsyncCommon({
                message: this.t('loadingfiles'),
                class: 'alert-info',
                method: 'GET',
                url: `?api/files`,
                removeFiles: false,
                data: false
            });
        },
        moveFilesToTrash: function(){
            let dataToSend = {
                files: this.filesToMoveToTrash
            };
            
            this.loadAsyncCommon({
                message: this.t('movingfilestotrash'),
                class: 'alert-warning',
                method: 'POST',
                url: `?api/files/movetotrash`,
                removeFiles: true,
                data: this.prepareFormData(dataToSend)
            });
        },
        prepareFormData(thing){
            let formData = new FormData();
            if (typeof thing == "object"){
                let preForm =this.toPreFormData(thing);
                for (const key in preForm) {
                    formData.append(key,preForm[key]);
                }
            }
            return formData;
        },
        restoreFiles: function(){
            let dataToSend = {
                files: this.filesToRestore
            };
            
            this.loadAsyncCommon({
                message: this.t('restoringfiles'),
                class: 'alert-info',
                method: 'POST',
                url: `?api/files/restore`,
                removeFiles: true,
                data: this.prepareFormData(dataToSend)
            });
        },
        removeFiles: function(xhr){
            if (xhr.status == 200){
                let responseDecoded = JSON.parse(xhr.response);
                if (responseDecoded && typeof responseDecoded == "object" && responseDecoded.hasOwnProperty('removedFiles') && Array.isArray(responseDecoded.removedFiles)){
                    let removedFiles = responseDecoded.removedFiles.filter((fileName)=>typeof fileName == "string");
                    this.files = this.files.filter((f)=>!removedFiles.includes(f.realname))
                    this.selectedFiles = this.selectedFiles.filter((fname)=>!removedFiles.includes(fname))
                }
            }
        },
        toPreFormData: function(thing,key =""){
            let type = typeof thing;
            switch (type) {
                case 'boolean':
                case 'number':
                case 'string':
                    return {
                        [key]:thing
                    };
                case 'object':
                    if (Object.keys(thing).length > 0){
                        let result = {};
                        for (const propkey in thing) {
                            result = {
                                ...result,
                                ...this.toPreFormData(
                                    thing[propkey],
                                    (key.length == 0) ? propkey : `${key}[${propkey}]`
                                )
                            }
                        }
                        return result;
                    } else if (thing === null) {
                        return {
                            [key]:null
                        };
                    } else {
                        return {
                            [key]: []
                        };
                    }
                
                case 'array':
                    if (thing.length == 0){
                        return {
                            [key]: []
                        };
                    }
                    let result = {};
                    thing.forEach((val,propkey)=>{
                        result = {
                            ...result,
                            ...this.toPreFormData(
                                val,
                                (key.length == 0) ? propkey : `${key}[${propkey}]`
                            )
                        }
                    });
                    return result;
                default:
                    return {
                        [key]:null
                    };
            }
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
        updateTypes: function(){
            if (this.files.length > 0){
                let newType = {};
                this.files.forEach((f)=>{
                    let statusCode = this.getStatusCode(f);
                    if (!newType.hasOwnProperty(statusCode)){
                        newType[statusCode] = this.getStatusLabelFromCode(statusCode);
                    }
                });
                this.types = newType
                if (!Object.keys(this.types).includes(this.currentType)){
                    this.currentType = "";
                }
            }
        }
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