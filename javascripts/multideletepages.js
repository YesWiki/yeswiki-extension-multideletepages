/*
 * This file is part of the YesWiki Extension multideletepages.
 *
 * Authors : see README.md file that was distributed with this source code.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import SpinnerLoader from '../../bazar/presentation/javascripts/components/SpinnerLoader.js'

let rootsElements = ['#pageAdmin'];
let isVueJS3 = (typeof Vue.createApp == "function");

let appParams = {
    components: { SpinnerLoader},
    data: function() {
        return {
            pages: [],
            text: '',
            ready: false,
            message: '',
            messageClass: {alert:true,['alert-info']:true},
            updating: false,
            selectedPagesToDelete: []
        };
    },
    methods: {
        isObject: function(objValue){
            return objValue && typeof objValue === 'object' && objValue.constructor === Object;
        },
        loadPages: function(){
            let pageAdminApp = this;
            pageAdminApp.message = "Chargement de la liste des pages";
            pageAdminApp.messageClass = {alert:true,['alert-info']:true};
            pageAdminApp.updating = true;
            $.ajax({
                method: "GET",
                url: wiki.url('api/pages'),
                success: function(data){
                pageAdminApp.message = '';
                    if (pageAdminApp.isObject(data)){
                    pageAdminApp.pages = [];
                        for (const key in data) {
                        pageAdminApp.pages.push(data[key]);
                        }
                pageAdminApp.pages.sort(function (a,b){
                    let ownerA = (!a.owner || a.owner == undefined) ? '' : a.owner;
                    let ownerB = (!b.owner || b.owner == undefined) ? '' : b.owner;
                    if (ownerA == ownerB){
                    if (a.time == b.time){
                        return 0;
                    } else {
                        return (a.time > b.time) ? -1 : 1;
                    }
                    } else if (ownerA.length == 0 && ownerB.length > 0){
                        return -1;
                    } else if (ownerA.length > 0 && ownerB.length == 0){
                        return 1;
                    } else if (ownerA.length == 0 && ownerB.length == 0){
                    if (a.time == b.time){
                        return 0;
                    } else {
                        return a.time > b.time ? -1 : 1;
                    }
                    } else {
                        return ownerA < ownerB ? -1 : 1;
                    }
                });
                }
            },
            error: function (){
              pageAdminApp.message = "Impossible de charger les pages";
              pageAdminApp.messageClass = {alert:true,['alert-danger']:true};
            },
            complete: function (){
                 pageAdminApp.ready= true;
                 pageAdminApp.updating = false;
            }
          });
        },
        deletePage: function(page,token,next = []){
              if (page.tag == undefined || page.tag.length == 0){
                  return;
              }
          let pageAdminApp = this;
          pageAdminApp.updating = true;
          pageAdminApp.message = `Suppression de ${page.tag}`;
          pageAdminApp.messageClass = {alert:true,['alert-info']:true};
          $.ajax({
              method: "POST",
              url: wiki.url(`${page.tag}/deletepage`,{confirme:'oui',eraselink:'oui'}),
              data: {
                  ['csrf-token']: token,
              },
              success: function(data){
                  pageAdminApp.message = '';
                  if (next.length == 0){
                    pageAdminApp.loadPages();
                  } else {
                       pageAdminApp.getDeleteTokenThenDelete({tag:next[0]},next.slice(1));
                  }
              },
              error: function(xhr,status,error){
                  pageAdminApp.message = `Suppression impossible de ${page.tag}`;
                  pageAdminApp.messageClass = {alert:true,['alert-danger']:true};
                  pageAdminApp.updating = false;
              },
              complete: function(){
                  pageAdminApp.selectedPagesToDelete = [];
              }
          });
         },
          getDeleteTokenThenDelete: function (page, next = []){
              if (page.tag == undefined || page.tag.length == 0){
                  return;
              }
          let pageAdminApp = this;
          $.ajax({
              method: "GET",
              url: wiki.url(`${page.tag}/deletepage`),
              success: function(data){
                let csrfTokenMatch = data.match(/name=\"csrf-token\" value=\"([^\"]*)\"/);
                if (csrfTokenMatch[1] == undefined || csrfTokenMatch[1].length == 0){
                    pageAdminApp.message = `Suppression impossible de ${page.tag} (mauvais jeton csrf)`;
                    pageAdminApp.messageClass = {alert:true,['alert-danger']:true};
                    pageAdminApp.updating = false;
                } else {
                    pageAdminApp.deletePage(page,csrfTokenMatch[1],next);
                }
              },
              error: function(xhr,status,error){
                pageAdminApp.message = `Suppression impossible de ${page.tag}`;
                pageAdminApp.messageClass = {alert:true,['alert-danger']:true};
                pageAdminApp.updating = false;
              }
          });
          },
        selectCustom: function(){
          let pageAdminApp = this;
               pageAdminApp.selectedPagesToDelete = [];
            if (this.$refs.customSelect.value.length == 0){
                return;
            }
               pageAdminApp.pages.forEach(p=>{
                   if ((p.owner == undefined || p.owner.length == 0) && p.user == this.$refs.customSelect.value){
                       pageAdminApp.selectedPagesToDelete.push(p.tag);
                   }
               });
        },
      toggleSelectedPage: function (tag){
          if(this.selectedPagesToDelete.includes(tag)){
              this.selectedPagesToDelete = this.selectedPagesToDelete.filter(e => (e != tag));
          } else {
              this.selectedPagesToDelete.push(tag);
          }
      },
      deleteSelectedPages: function (){
          if (this.selectedPagesToDelete.length == 0){
              toastMessage('Aucune page à supprimer', 2000, 'alert alert-info')
          } else {
             let pageAdminApp = this;
             pageAdminApp.updating = true;
             pageAdminApp.message = "Suppression des pages sélectionnées <br>"+this.selectedPagesToDelete.join("<br>");
             pageAdminApp.messageClass = {alert:true,['alert-info']:true};
             pageAdminApp.getDeleteTokenThenDelete({tag:this.selectedPagesToDelete[0]},this.selectedPagesToDelete.slice(1));
          }
      },
    },
    mounted(){
        this.loadPages();
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