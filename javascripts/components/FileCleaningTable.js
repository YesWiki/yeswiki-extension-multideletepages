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
        formatAFile: function(file){
            return {
                status: file.hasOwnProperty('status') ? file.status : "",
                name: file.name || file.realname || "",
                realname: file.realname || "",
                pagetags: file.pagetags || [],
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
                            data:"status",
                            title: this.fromSlot("status"),
                            render: (status) =>{
                                let statusKey = this.$root.sourceStatus[status]
                                if (typeof status != "number" || statusKey == undefined){
                                    return "error";
                                } else {
                                    let color = "";
                                    switch (status) {
                                        case 0:
                                            color = "green";
                                            break;
                                        case 2:
                                            color = "red";
                                            break;
                                    
                                        case 6:
                                            color = "orange";
                                            break;
                                    
                                        default:
                                            break;
                                    }
                                    if (color.length > 0){
                                        return '<span style="color:'+color+';">'+this.$root.t("status"+statusKey)+'</span>';
                                    } else {
                                        return this.$root.t("status"+statusKey);
                                    }
                                }
                            },
                            className: "files-cleaning-table-status",
                            contentPadding: "mmmmmmmmmmmmmmmm"
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
                                return tags.map((tag)=>{
                                    let rev = (file.status == 0 && file.associatedPageTag == tag && file.pageversion) ? ` (${file.pageversion})`: '';
                                    return `<a class="modalbox" data-iframe="1" data-size="modal-lg" href="${wiki.url(tag+'/iframe')}" title="${tag}">${tag}${rev}</a>`;
                                }).join('');
                            },
                            className: "files-cleaning-table-break-word-column"
                        }
                    ]
                },
                order:[
                    [4,'desc'], // pagetag
                    [1,'desc'], // status
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
        }
    },
    watch: {
        domContentLoaded: function(){
            if (this.domContentLoaded){
                this.dataTable;
            }
        },
        formattedFiles: function(newVals,oldVals){
            let newValsFiles = newVals.map((e)=>e.realname)
            let oldValsFiles = oldVals.map((e)=>e.realname)
            if (this.dataTableInternal){
                let newFiles = newVals.filter((e)=>!oldValsFiles.includes(e.realname))
                if (newFiles.length > 0){
                    this.addNewFiles(newFiles)
                }
                let oldFiles = oldVals.filter((e)=>!newValsFiles.includes(e.realname))
                if (oldFiles.length > 0){
                    this.removeOldFiles(oldFiles)
                }
                if (newFiles.length > 0 || oldFiles.length > 0){
                    this.dataTable.draw();
                }
                $(this.dataTable.header()).find('input').first().get(0).checked = false;
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