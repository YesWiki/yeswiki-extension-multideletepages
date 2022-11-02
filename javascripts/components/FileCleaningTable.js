/*
 * This file is part of the YesWiki Extension multideletepages.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export default {
    props: ['files','domContentLoaded'],
    data: function(){
        return {
            dataTableInternal: null,
            selectedFiles: [],
        };
    },
    computed: {
        dataTable: function(){
            // lazy loading
            if (!this.dataTableInternal){
                this.initDataTable();
            }
            return this.dataTableInternal;
        },
        formattedFiles: function(){
            return this.files.map((file)=>{
                return this.formatAFile(file);
            })
        }
    },
    methods: {
        addNewFiles: function(files){
            this.dataTable.rows.add(files.map((file)=>this.formatAFile(file)))
        },
        attachReactiveCheckbox: function(){
            let datatable = this.dataTable;
            datatable.rows().every((rowIdx)=>{
                // tooltips
                datatable.cell(rowIdx,1).node().querySelectorAll('i[data-toggle="tooltip"]').forEach((item)=>{
                    if (!item.classList.contains('tooltip-created')){
                        item.classList.add('tooltip-created')
                        $(item).tooltip({trigger:'hover focus click'})
                    }
                })
                // checkboxes
                var input = datatable.cell(rowIdx,0).node().getElementsByTagName('input')[0]
                if (!input.classList.contains('vuejsEventInitialized')){
                    input.classList.add('vuejsEventInitialized')
                    input.parentNode.addEventListener("click",(e)=>this.updateCheckboxAfterClick(e.target))
                }
                this.updateCheckboxAfterClick(input,false)
            })
            let headerInput = $(datatable.header()).find('input').first();
            if (headerInput && headerInput.hasClass('selectAll')){
                let input = headerInput.get(0)
                if (!input.classList.contains('vuejsEventInitialized')){
                    input.classList.add('vuejsEventInitialized')
                    input.parentNode.addEventListener("click",(e)=>this.updateCheckboxAllAfterClick(e.target))
                }
                this.updateCheckboxAllAfterClick(input,false)
            }
        },
        filesEquals: function(fileA,fileB){
            for (const key in fileA) {
                if (!fileB.hasOwnProperty(key) || fileB[key] != fileA[key]){
                    return false;
                }
            }
            return Object.keys(fileA).length ==  Object.keys(fileB).length;
        },
        formatAFile: function(file){
            return {
                name: file.name || file.realname || "",
                isDeleted: file.isDeleted,
                isUsed: file.isUsed,
                isLatestFileRevision: file.isLatestFileRevision,
                realname: file.realname || "",
                pagetags: typeof file.pagetags == "object" ? file.pagetags :  {},
                uploadtime: file.uploadtime || "",
                pageversion: file.pageversion || "",
                associatedPageTag: file.associatedPageTag || "",
            };
        },
        fromSlot: function(name){
            if (typeof this.$scopedSlots[name] == "function"){
                let slot = (this.$scopedSlots[name])();
                if (typeof slot == "object"){
                    return slot[0].text;
                }
            }
            return "";
        },
        initDataTable: function(){
            this.dataTableInternal = $(this.$refs.dataTable).DataTable({
                ...DATATABLE_OPTIONS,
                ...{
                    data: this.formattedFiles,
                    columns: [
                        {
                            data:"realname",
                            title:`<label><input type="checkbox" class="selectAll"/><span></span></label>`,
                            render: function (file) {
                                return `<label><input type="checkbox" data-file="${file}"/><span></span></label>`;
                            },
                            orderable: false
                        },
                        {
                            data:"isDeleted",
                            title: this.fromSlot("status"),
                            render: (isDeleted,idx,file) =>{
                                let outputs = [];
                                if (file.isDeleted){
                                    outputs.push(`<i style="color:red;" class="fas fa-trash-alt" data-toggle="tooltip" title="${this.$root.t('statusisdeleted')}"></i>`)
                                }
                                if (file.associatedPageTag.length > 0){
                                    outputs.push(`<i class="fas fa-link" data-toggle="tooltip" title="${this.$root.t('statusassociatedtotag')}"></i>`)
                                }
                                if (file.isUsed){
                                    outputs.push(`<i style="color:green;" class="fas fa-thumbs-up" data-toggle="tooltip" title="${this.$root.t('statusisused')}"></i>`)
                                } else if (file.isUsed === null) {
                                    outputs.push(`<i style="color:orange;" class="fas fa-history" data-toggle="tooltip" title="${this.$root.t('statustocheck')}"></i>`)
                                } else {
                                    outputs.push(`<i class="fas fa-thumbs-down" data-toggle="tooltip" title="${this.$root.t('statusisnotused')}"></i>`)
                                }
                                if (file.isLatestFileRevision){
                                    outputs.push(`<i class="far fa-clock" data-toggle="tooltip" title="${this.$root.t('statusislastestfilerevision')}"></i>`)
                                }
                                return outputs.join(' ');
                            },
                            className: "files-cleaning-table-status",
                            contentPadding: "mmmmmmmmmmmm"
                        },
                        {
                            data:"name",
                            title:this.fromSlot("name"),
                            render: (name,idx,file) =>{
                                return `<a target="_blank" href="${wiki.baseUrl.replace('?','')}files/${file.realname}">${name}</a>`;
                            },
                            className: "files-cleaning-table-break-word-column"
                        },
                        {data:"uploadtime",title:this.fromSlot("uploadtime")},
                        {
                            data:"pagetags",
                            title:this.fromSlot("pagetag")+` (${this.fromSlot("pageversion")})`,
                            render: function ( tags, idx, file ) {
                                let localTags = (typeof tags != "object") ? {} : tags;
                                if (file.associatedPageTag.length > 0 && !localTags.hasOwnProperty(file.associatedPageTag)){
                                    localTags[file.associatedPageTag] = [{
                                        time: 2,
                                        latest: 2
                                    }];
                                }
                                return Object.keys(localTags).map((tag)=>{
                                    let rev ="";
                                    let params = {};
                                    if (file.isUsed == 1){
                                        let found = false;
                                        localTags[tag].forEach((revision)=>{
                                            if (!found && revision.latest === false && typeof revision.time == "string"){
                                                found = true;
                                                rev = ` (${revision.time})`;
                                                params.time = revision.time;
                                            }
                                        })
                                    }
                                    return `<a class="modalbox" data-iframe="1" data-size="modal-lg" href="${wiki.url(tag+'/iframe',params)}" title="${tag}">${tag}${rev}</a>`;
                                }).join('<br/>');
                            },
                            className: "files-cleaning-table-break-word-column"
                        }
                    ]
                },
                order:[
                    [4,'desc'], // pagetag
                    [2,'desc'], // uploadtime
                ],
                "scrollX": true
            });
            this.dataTableInternal.on('draw',()=>{
                this.attachReactiveCheckbox()
            })
            this.dataTableInternal.draw();
        },
        isObject: function(objValue){
            return this.$root.isObject(objValue);
        },
        removeOldFiles: function(files){
            let filesNames = files.map((e)=>e.realname)
            this.dataTable.rows(function ( idx, data ) {
                return filesNames.includes(data.realname);
            }).remove()
        },
        updateCheckboxAfterClick: function (input, toggleValue = true){
            if (input.tagName == "INPUT"){
                let file = input.dataset.file;
                if (this.selectedFiles.includes(file)){
                    input.checked = !toggleValue;
                    if (toggleValue){
                        this.selectedFiles = this.selectedFiles.filter((fileName)=>fileName != file)
                    }
                } else {
                    input.checked = toggleValue;
                    if (toggleValue){
                        this.selectedFiles = [...this.selectedFiles,file]
                    }
                }
                if (toggleValue){
                    $(this.dataTable.header()).find('input').first().get(0).checked = false;
                }
            }
        },
        updateCheckboxAllAfterClick: function (input, toggleValue = true){
            if (input.tagName == "INPUT"){
                if (toggleValue){
                    if (!input.checked){
                        this.selectedFiles = [];
                    } else {
                        this.selectedFiles = this.files.map((f)=>f.realname)
                    }
                        
                    let datatable = this.dataTable;
                    datatable.rows().every((rowIdx)=>{
                        var inputint = datatable.cell(rowIdx,0).node().getElementsByTagName('input')[0]
                        this.updateCheckboxAfterClick(inputint,false)
                    })
                    datatable.draw();
                } else {
                    let filesList = this.files.map((f)=>f.realname);
                    if (this.files.filter((f)=>!this.selectedFiles.includes(f.realname)).length > 0 ||
                        this.selectedFiles.filter((f)=>!filesList.includes(f)).length > 0) {
                        input.ckecked = false;
                    } else {
                        input.ckecked = true;
                    }
                }
            }
        },
    },
    watch: {
        domContentLoaded: function(){
            if (this.domContentLoaded){
                this.dataTable;
            }
        },
        formattedFiles: function(newVals,oldVals){
            if (this.dataTableInternal){
                let draw = false;
                [
                    {valsToFilter: oldVals,valsToCompare: newVals,func:this.removeOldFiles},
                    {valsToFilter: newVals,valsToCompare: oldVals,func:this.addNewFiles}
                ].forEach((d)=>{
                    let fileNamesToCompare = d.valsToCompare.map((e)=>e.realname)
                    let files = d.valsToFilter.filter((f)=>{
                        let idx = fileNamesToCompare.findIndex((fname)=>fname==f.realname)
                        return idx == -1 || !this.filesEquals(f,d.valsToCompare[idx])
                    });
                    if (files.length > 0){
                        d.func(files)
                        draw = true
                    }
                })
                if (draw){
                    $(this.dataTable.header()).find('input').first().get(0).checked = false;
                    this.dataTable.draw();
                }
            }
        },
        selectedFiles: function(){
            this.$root.selectedFiles = this.selectedFiles;
        },
    },
    template: `
      <table ref="dataTable"></table>
    `
  }