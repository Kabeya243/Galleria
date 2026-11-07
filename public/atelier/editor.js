(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = (message, error = false) => {
    const node = $("#toast"); node.textContent = message; node.className = `toast show${error ? " error" : ""}`;
    window.setTimeout(() => node.classList.remove("show"), 2800);
  };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const palette = ["#ffffff","#f5f2ec","#f0e2cd","#d9e3d8","#293f39","#c86643","#e9c778","#6a6488","#d9e8ed","#202623"];
  const samples = [["#f1d0b1","#c86643","#f5eddb"],["#f0e2cd","#42584b","#f6d69a"],["#d9e3d8","#b8644d","#293f39"],["#e6d9e7","#685377","#f4e7d4"],["#d4e4eb","#315e68","#e4c477"],["#f2e7cb","#9f583f","#343b34"],["#e2e8de","#527264","#e8ba73"],["#293f39","#c86643","#f5eddb"]];
  const state = { initialized:false, project:{id:null,name:"Design sans titre",pages:[]}, pageIndex:0, canvas:null, zoom:1, history:[], historyIndex:-1, restoring:false, saved:false, activeTab:"templates", grid:false, safe:false, snapLines:[], autoSave:null };
  const currentPage = () => state.project.pages[state.pageIndex];
  const activeObjects = () => state.canvas?.getActiveObjects() || [];
  const markDirty = () => { state.saved = false; $("#save-status").textContent = "Modifications non enregistrées"; };
  function snapshot() {
    if (state.restoring || !state.canvas) return;
    const page = currentPage();
    page.width = page.width || state.canvas.getWidth() / state.zoom;
    page.height = page.height || state.canvas.getHeight() / state.zoom;
    page.objects = state.canvas.getObjects().filter((object) => !object.isGuide).map((object) => object.toObject(["src","cornerRadius","grayscale","sepia","brightness","contrast","saturation","locked","underline","lineHeight","letterSpacing","textAlign"]));
    while (state.history.length > state.historyIndex + 1) state.history.pop();
    state.history.push(JSON.stringify(page));
    if (state.history.length > 50) state.history.shift();
    state.historyIndex = state.history.length - 1;
    markDirty(); renderLayers(); updateProperties();
  }
  function changePage(delta) {
    const target=state.pageIndex+delta;
    if(target>=0&&target<state.project.pages.length){storeCurrentPage();setPage(state.project.pages[target],target);}
  }
  function movePage(delta) {
    const target=state.pageIndex+delta;if(target<0||target>=state.project.pages.length)return;
    storeCurrentPage();const [page]=state.project.pages.splice(state.pageIndex,1);state.project.pages.splice(target,0,page);setPage(page,target);markDirty();
  }
  function renamePage() {
    const page=currentPage(),chip=document.querySelector(`[data-page-index="${state.pageIndex}"]`);
    if(!chip)return;
    const input=document.createElement("input");
    input.value=page.name||`Page ${state.pageIndex+1}`;input.className="page-rename-input";input.setAttribute("aria-label","Nom de la page");
    chip.replaceWith(input);input.focus();input.select();
    let done=false;
    const commit=()=>{if(done)return;done=true;page.name=input.value.trim()||`Page ${state.pageIndex+1}`;renderPageList();markDirty();};
    input.addEventListener("keydown",(event)=>{if(event.key==="Enter")commit();if(event.key==="Escape"){done=true;renderPageList();}event.stopPropagation();});
    input.addEventListener("blur",commit);
  }
  function deletePage() {
    if(state.project.pages.length<2){toast("Un projet doit conserver au moins une page.",true);return;}
    const button=$("#delete-page");
    if(!button.dataset.armed){button.dataset.armed="1";button.classList.add("armed");toast("Cliquez à nouveau pour supprimer cette page.");window.setTimeout(()=>{delete button.dataset.armed;button.classList.remove("armed");},3000);return;}
    delete button.dataset.armed;button.classList.remove("armed");
    state.project.pages.splice(state.pageIndex,1);const index=Math.max(0,state.pageIndex-1);setPage(state.project.pages[index],index);markDirty();
  }
  function drawGuides(lines = []) {
    if (!state.canvas) return;
    const ctx = state.canvas.contextTop;
    state.canvas.clearContext(ctx);
    if (!lines.length) return;
    const zoom = state.zoom;
    ctx.save(); ctx.setTransform(zoom,0,0,zoom,0,0); ctx.strokeStyle = "#db7350"; ctx.lineWidth = 1 / zoom; ctx.setLineDash([5 / zoom,4 / zoom]);
    for (const line of lines) { ctx.beginPath(); if (line.axis === "x") { ctx.moveTo(line.value,0); ctx.lineTo(line.value,currentPage().height); } else { ctx.moveTo(0,line.value); ctx.lineTo(currentPage().width,line.value); } ctx.stroke(); }
    ctx.restore();
  }
  function applyImagePreview(object) {
    if(!fabric.Image.filters)return;
    const filters=[];
    if(object.brightness!==undefined&&object.brightness!==1)filters.push(new fabric.Image.filters.Brightness({brightness:object.brightness-1}));
    if(object.contrast!==undefined&&object.contrast!==1)filters.push(new fabric.Image.filters.Contrast({contrast:object.contrast-1}));
    if(object.saturation!==undefined&&object.saturation!==1)filters.push(new fabric.Image.filters.Saturation({saturation:object.saturation-1}));
    if(object.grayscale)filters.push(new fabric.Image.filters.Grayscale());
    if(object.sepia)filters.push(new fabric.Image.filters.Sepia());
    object.filters=filters;object.applyFilters();
  }
  function createCanvas(page) {
    state.restoring = true;
    const canvasEl = $("#design-canvas");
    if (state.canvas) state.canvas.dispose();
    state.canvas = new fabric.Canvas(canvasEl, { selection:true, preserveObjectStacking:true, selectionKey:"shiftKey", backgroundColor:page.background || "#ffffff" });
    state.canvas.setDimensions({width:page.width,height:page.height});
    state.canvas.on("object:added", () => { if (!state.restoring) snapshot(); });
    state.canvas.on("object:modified", snapshot);
    state.canvas.on("object:removed", () => { if (!state.restoring) snapshot(); });
    state.canvas.on("selection:created", updateProperties);
    state.canvas.on("selection:updated", updateProperties);
    state.canvas.on("selection:cleared", updateProperties);
    state.canvas.on("object:moving", snapObject);
    state.canvas.on("mouse:up", () => drawGuides());
    state.canvas.on("text:changed", snapshot);
    state.canvas.on("object:scaling", () => drawGuides());
    state.canvas.loadFromJSON({objects:page.objects || [],background:page.background || "#ffffff"}, () => {
      for (const object of state.canvas.getObjects()) applyLock(object);
    for (const object of state.canvas.getObjects()) if(object.type==="image")applyImagePreview(object);
      state.canvas.renderAll(); state.restoring = false;
      state.history = [JSON.stringify(page)]; state.historyIndex = 0;
      fitCanvas(); renderPageList(); updateDimensions(); renderLayers(); updateProperties();
    });
  }
  function fitCanvas() {
    if (!state.canvas) return;
    const viewport = $("#canvas-viewport");
    const page = currentPage();
    const ratio = Math.min((viewport.clientWidth - 80) / page.width, (viewport.clientHeight - 80) / page.height, 1);
    setZoom(Math.max(.12, ratio));
  }
  function setZoom(value) {
    state.zoom = Math.max(.12, Math.min(2.5, value));
    const page = currentPage(); if (!state.canvas || !page) return;
    const w = Math.round(page.width * state.zoom), h = Math.round(page.height * state.zoom);
    state.canvas.setDimensions({width:w,height:h});
    state.canvas.setZoom(state.zoom);
    const container = state.canvas.wrapperEl;
    container.style.width = `${w}px`; container.style.height = `${h}px`;
    $("#canvas-wrap").style.width = `${w}px`; $("#canvas-wrap").style.height = `${h}px`;
    $("#zoom-label").textContent = `${Math.round(state.zoom * 100)}%`;
    state.canvas.calcOffset(); state.canvas.renderAll();
  }
  function updateDimensions() {
    const page = currentPage(); if (!page) return;
    $("#dimensions").textContent = `${page.width} × ${page.height} px`;
  }
  function setPage(page, index = 0) {
    if (!page.objects) page.objects = [];
    if (!page.width) page.width = 1080;
    if (!page.height) page.height = 1080;
    state.project.pages[index] = page; state.pageIndex = index; createCanvas(page);
  }
  function addObject(object) {
    const page = currentPage();
    const left = object._positionExplicit ? object.left : Math.round((page.width - object.getScaledWidth()) / 2);
    const top = object._positionExplicit ? object.top : Math.round((page.height - object.getScaledHeight()) / 2);
    object.set({originX:"left",originY:"top",left,top,cornerColor:"#c9a86a",borderColor:"#c9a86a",transparentCorners:false});
    state.canvas.add(object); state.canvas.setActiveObject(object); object.setCoords(); state.canvas.requestRenderAll(); updateProperties();
  }
  function addText(text, size = 40, weight = false) {
    const object = new fabric.IText(text, {width:500,fontSize:size,fontFamily:"Manrope",fontWeight:weight?"bold":"normal",fill:"#293f39",lineHeight:1.2,originX:"left",originY:"top"});
    addObject(object); object.enterEditing(); object.selectAll();
  }
  function addShape(type) {
    const common = {fill:"#c86643",strokeWidth:0,originX:"left",originY:"top"};
    let shape;
    if (type === "circle") shape = new fabric.Ellipse({...common,rx:72,ry:72,width:144,height:144});
    else if (type === "triangle") shape = new fabric.Triangle({...common,width:150,height:145});
    else if (type === "line") shape = new fabric.Line([0,0,190,0],{...common,stroke:"#293f39",strokeWidth:5,fill:""});
    else if (type === "star") shape = new fabric.Polygon(Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?40:90;return{x:95+r*Math.cos(a),y:95+r*Math.sin(a)}}),{...common,width:190,height:190});
    else if (type === "arrow") shape = new fabric.Polygon([{x:0,y:35},{x:130,y:35},{x:130,y:0},{x:190,y:55},{x:130,y:110},{x:130,y:75},{x:0,y:75}],{...common,width:190,height:110});
    else shape = new fabric.Rect({...common,width:180,height:125,rx:type==="roundRect"?20:0,ry:type==="roundRect"?20:0});
    addObject(shape);
  }
  function escapeText(text){return escapeHTML(text).replace(/\n/g," ");}
  function setPanel(tab) {
    state.activeTab = tab;
    const labels = {templates:["COMMENCER","Modèles"],elements:["COMPOSER","Éléments"],text:["ÉCRIRE","Texte"],photos:["INSPIRATION","Photos"],uploads:["VOTRE BIBLIOTHÈQUE","Importer"],artworks:["VOS ŒUVRES","Mes œuvres"],background:["PERSONNALISER","Fond"]};
    $("#panel-kicker").textContent=labels[tab][0];$("#panel-title").textContent=labels[tab][1];
    $$(".tool-tab[data-tab]").forEach((button)=>button.classList.toggle("active",button.dataset.tab===tab));
    renderPanel();
  }
  function renderPanel() {
    const root=$("#panel-content");
    if (state.activeTab==="templates") {
      root.innerHTML=`<input class="panel-search" id="template-search" placeholder="Rechercher un modèle…"><div class="action-card"><h3>Créer votre format</h3><div class="field"><label>Unité</label><select id="custom-unit"><option value="px">Pixels</option><option value="mm">Millimètres</option><option value="cm">Centimètres</option></select></div><div class="field-row"><div class="field"><label>Largeur</label><input id="custom-width" type="number" value="1080" min="1" max="6000"></div><div class="field"><label>Hauteur</label><input id="custom-height" type="number" value="1080" min="1" max="6000"></div></div><button id="create-custom">Créer une page vierge</button></div><div class="panel-template-list" id="panel-template-list" style="display:contents"></div>`;
      root.querySelector("#create-custom").onclick=()=>{const unit=$("#custom-unit").value,factor={px:1,mm:96/25.4,cm:96/2.54}[unit],rawWidth=Number($("#custom-width").value),rawHeight=Number($("#custom-height").value),width=Math.round(rawWidth*factor),height=Math.round(rawHeight*factor);if(!width||!height||width>6000||height>6000){toast("Dimensions valides requises (1 à 6000 px après conversion).",true);return;}const physicalWidthMm=unit==="px"?rawWidth*25.4/96:unit==="cm"?rawWidth*10:rawWidth,physicalHeightMm=unit==="px"?rawHeight*25.4/96:unit==="cm"?rawHeight*10:rawHeight;state.project={id:null,name:$("#project-name").value,pages:[{width,height,physicalWidthMm,physicalHeightMm,background:"#ffffff",objects:[]}]};setPage(state.project.pages[0]);};
      loadTemplatesIntoPanel(); root.querySelector("#template-search").addEventListener("input",filterTemplates);
    } else if(state.activeTab==="elements") {
      root.innerHTML=`<div class="element-button" data-shape="rect"><span>▭</span>Rectangle</div><div class="element-button" data-shape="roundRect"><span>▢</span>Arrondi</div><div class="element-button" data-shape="circle"><span>◯</span>Cercle</div><div class="element-button" data-shape="triangle"><span>△</span>Triangle</div><div class="element-button" data-shape="line"><span>―</span>Ligne</div><div class="element-button" data-shape="arrow"><span>➜</span>Flèche</div><div class="element-button" data-shape="star"><span>☆</span>Étoile</div><div class="action-card"><h3>Calques</h3><p>Sélectionnez un élément pour le personnaliser. Glissez dans la liste des calques pour changer l’ordre.</p></div>`;
      $$("[data-shape]",root).forEach(button=>button.onclick=()=>addShape(button.dataset.shape));
    } else if(state.activeTab==="text") {
      root.innerHTML=`<button class="panel-action" id="add-heading" style="font-size:20px;font-weight:700">Ajouter un titre</button><button class="panel-action" id="add-subheading" style="font-size:16px">Ajouter un sous-titre</button><button class="panel-action" id="add-body">Ajouter un paragraphe</button><div class="action-card"><h3>Modifier le texte</h3><p>Double-cliquez sur un texte du canvas pour saisir votre contenu directement.</p></div>`;
      $("#add-heading").onclick=()=>addText("Votre titre",56,true);$("#add-subheading").onclick=()=>addText("Un sous-titre",36);$("#add-body").onclick=()=>addText("Ajoutez votre texte ici",23);
    } else if(state.activeTab==="artworks") {
      const artworks=(window.EDITOR_CONFIG&&window.EDITOR_CONFIG.artworks)||[];
      root.innerHTML=artworks.length?`<div class="action-card"><h3>Vos œuvres</h3><p>Cliquez sur une œuvre pour l’ajouter à la page.</p></div><div class="upload-gallery" id="artworks-gallery" style="display:contents"></div>`:`<div class="action-card"><h3>Vos œuvres</h3><p>Vous n’avez pas encore d’œuvre. Ouvrez une exposition dans l’éditeur et ajoutez votre première œuvre — elle apparaîtra ici.</p></div>`;
      const gallery=$("#artworks-gallery");
      if(gallery){gallery.innerHTML=artworks.map((item)=>`<img class="asset-thumb" src="${escapeHTML(item.imageUrl)}" data-src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.title)}" title="${escapeHTML(item.title)}">`).join("");$$(".asset-thumb",gallery).forEach((image)=>image.onclick=()=>addImage(image.dataset.src));}
    } else if(state.activeTab==="uploads") {
      root.innerHTML=`<label class="upload-drop" id="upload-drop"><strong>↑ Importer une image</strong>Déposez un fichier ici ou cliquez pour parcourir<br>JPG · PNG · WebP · SVG · 15 Mo max</label><div class="upload-gallery" id="upload-gallery" style="display:contents"></div>`;
      $("#upload-drop").onclick=()=>$("#file-input").click();$("#upload-drop").ondragover=(event)=>{event.preventDefault();event.currentTarget.style.background="#f0f3ed";};$("#upload-drop").ondragleave=(event)=>{event.currentTarget.style.background="";};$("#upload-drop").ondrop=(event)=>{event.preventDefault();uploadFiles(event.dataTransfer.files);};
      loadUploads();
    } else if(state.activeTab==="photos") {
      root.innerHTML=`<div class="action-card"><h3>Formes & compositions</h3><p>Quelques images abstraites libres intégrées pour démarrer. Les compositions sont générées localement.</p><button id="load-abstracts">Ajouter une composition graphique</button><button class="panel-action" id="open-upload">Importer mes photos</button></div><div class="background-colors" id="photo-swatches"></div>`;
      root.querySelector("#load-abstracts").onclick=()=>addAbstractPhoto();root.querySelector("#open-upload").onclick=()=>{setPanel("uploads");setTimeout(()=>$("#file-input").click(),0);};
      $("#photo-swatches").innerHTML=`<button style="background:#d9e3d8" data-abstract="#d9e3d8"></button><button style="background:#f1d0b1" data-abstract="#f1d0b1"></button><button style="background:#d4e4eb" data-abstract="#d4e4eb"></button><button style="background:#e8d8e6" data-abstract="#e8d8e6"></button><button style="background:#f0e2cd" data-abstract="#f0e2cd"></button>`;
      $$("[data-abstract]").forEach(button=>button.onclick=()=>addAbstractPhoto(button.dataset.abstract));
    } else {
      root.innerHTML=`<div class="action-card"><h3>Couleur de la page</h3><p>Choisissez une couleur pour l’arrière-plan de votre design.</p><div class="field"><label>Couleur personnalisée</label><input type="color" id="page-color" value="${escapeHTML(currentPage().background||"#ffffff")}"></div></div><div class="background-colors">${palette.map(color=>`<button data-bg="${color}" style="background:${color}" title="${color}"></button>`).join("")}</div><div class="action-card"><h3>Pages</h3><div class="page-size-presets"><button data-size="1080,1080">Carré · 1080</button><button data-size="1080,1920">Story · 1080</button><button data-size="794,1123">A4 · 794</button><button data-size="1600,900">Présentation</button></div></div>`;
      $("#page-color").oninput=(event)=>setBackground(event.target.value);$$("[data-bg]",root).forEach(button=>button.onclick=()=>setBackground(button.dataset.bg));$$("[data-size]",root).forEach(button=>button.onclick=()=>resizePage(...button.dataset.size.split(",").map(Number)));
    }
  }
  async function loadTemplatesIntoPanel() {
    const list=$("#panel-template-list");if(!list)return;
    try {
      const response=await fetch("/api/atelier/templates");if(!response.ok)throw new Error("Galerie indisponible.");
      const templates=await response.json();
      list.innerHTML=templates.map((item,index)=>`<button class="panel-template" data-template="${escapeHTML(item.id)}" data-name="${escapeHTML(item.name)}"><span class="panel-sample" style="--sample-bg:${samples[index%samples.length][0]};--sample-main:${samples[index%samples.length][1]};--sample-text:${samples[index%samples.length][2]}"><span>${escapeHTML((item.objects?.find(object=>object.text)?.text||item.name).split("\n").slice(0,2).join("\n"))}</span></span><small>${escapeHTML(item.name)}</small></button>`).join("");
      $$("[data-template]",list).forEach(button=>button.onclick=()=>openTemplate(button.dataset.template));
    } catch(error){list.innerHTML=`<div class="action-card">${escapeHTML(error.message)}</div>`;}
  }
  function filterTemplates(event){const query=event.target.value.toLocaleLowerCase("fr");$$(".panel-template").forEach(button=>button.hidden=!button.dataset.name.toLocaleLowerCase("fr").includes(query));}
  async function openTemplate(id) {
    try {const response=await fetch(`/api/atelier/templates/${encodeURIComponent(id)}`);if(!response.ok)throw new Error((await response.json()).detail||"Modèle introuvable.");const template=await response.json();const page=template.pages?.[0]||template;state.project={id:null,name:template.name,pages:JSON.parse(JSON.stringify(template.pages||[page]))};$("#project-name").value=state.project.name;setPage(state.project.pages[0],0);toast("Modèle ouvert. Personnalisez-le à votre façon.");}
    catch(error){toast(error.message,true);}
  }
  function addAbstractPhoto(color="#d9e3d8") {
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700"><rect width="900" height="700" fill="${color}"/><circle cx="640" cy="210" r="205" fill="#c86643"/><path d="M0 520 Q300 330 570 530 T900 510 V700 H0Z" fill="#365447"/><path d="M70 600 Q280 440 500 600" fill="none" stroke="#f4d791" stroke-width="23" stroke-linecap="round"/></svg>`;
    const src=`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    fabric.Image.fromURL(src,image=>{image.set({width:360,height:280,scaleX:1,scaleY:1,src});addObject(image);},{crossOrigin:"anonymous"});
  }
  async function loadUploads() {
    try {const response=await fetch("/api/atelier/uploads");if(!response.ok)throw new Error();const uploads=await response.json();const root=$("#upload-gallery");if(!root)return;root.innerHTML=uploads.map(file=>`<img class="asset-thumb" src="${escapeHTML(file.thumbnail)}" data-src="${escapeHTML(file.url)}" alt="Image importée" title="Cliquer pour ajouter">`).join("");$$(".asset-thumb",root).forEach(image=>image.onclick=()=>addImage(image.dataset.src));}
    catch(_){toast("Impossible de charger les images importées.",true);}
  }
  async function uploadFiles(files) {
    for(const file of files){const body=new FormData();body.append("file",file);try{const response=await fetch("/api/atelier/uploads",{method:"POST",body});const result=await response.json();if(!response.ok)throw new Error(result.detail||"Import refusé.");toast("Image importée.");await loadUploads();addImage(result.url);}catch(error){toast(error.message,true);}}
  }
  function addImage(url) {
    fabric.Image.fromURL(url,(image)=>{
      if(!image.width){toast("Cette image ne peut pas être ouverte.",true);return;}
      const max=Math.min(currentPage().width*.52/image.width,currentPage().height*.52/image.height,1);
      image.set({scaleX:max,scaleY:max,src:url,cornerRadius:0,brightness:1,contrast:1,saturation:1});
      addObject(image);
    },{crossOrigin:"anonymous"});
  }
  function addPage(copy=false) {
    const source=currentPage();const page=copy?JSON.parse(JSON.stringify(source)):{width:source.width,height:source.height,background:source.background,objects:[]};
    state.project.pages.splice(state.pageIndex+1,0,page);setPage(page,state.pageIndex+1);markDirty();
  }
  function renderPageList() {
    $("#page-list").innerHTML=state.project.pages.map((page,index)=>`<button class="page-chip${index===state.pageIndex?" active":""}" data-page-index="${index}" title="${escapeHTML(page.name||`Page ${index+1}`)}">${escapeHTML(page.name||`Page ${index+1}`)} · ${page.width}×${page.height}</button>`).join("");
    $$("[data-page-index]").forEach(button=>button.onclick=()=>{storeCurrentPage();setPage(state.project.pages[Number(button.dataset.pageIndex)],Number(button.dataset.pageIndex));});
  }
  function storeCurrentPage(){if(!state.canvas)return;const page=currentPage();page.objects=state.canvas.getObjects().filter(obj=>!obj.isGuide).map(obj=>obj.toObject(["src","cornerRadius","grayscale","sepia","brightness","contrast","saturation","locked","underline","lineHeight","letterSpacing","textAlign"]));page.background=state.canvas.backgroundColor||page.background;}
  function setBackground(color){currentPage().background=color;state.canvas.backgroundColor=color;state.canvas.requestRenderAll();markDirty();snapshot();}
  function resizePage(width,height){const page=currentPage();page.width=width;page.height=height;page.physicalWidthMm=width*25.4/96;page.physicalHeightMm=height*25.4/96;state.canvas.setDimensions({width,height});fitCanvas();updateDimensions();renderPageList();snapshot();}
  function snapObject(event) {
    const target=event.target,page=currentPage(),threshold=8/state.zoom,lines=[];
    const left=target.left,top=target.top,w=target.getScaledWidth(),h=target.getScaledHeight();
    const xPoints=[left,left+w/2,left+w],yPoints=[top,top+h/2,top+h];
    const xTargets=[0,page.width/2,page.width],yTargets=[0,page.height/2,page.height];
    for(const other of state.canvas.getObjects()){if(other===target||other.isGuide)continue;const ow=other.getScaledWidth(),oh=other.getScaledHeight();xTargets.push(other.left,other.left+ow/2,other.left+ow);yTargets.push(other.top,other.top+oh/2,other.top+oh);}
    let dx=0,dy=0,bestX=threshold,bestY=threshold,xGuide=null,yGuide=null;
    for(const x of xPoints)for(const to of xTargets){const delta=to-x;if(Math.abs(delta)<bestX){bestX=Math.abs(delta);dx=delta;xGuide=to;}}
    for(const y of yPoints)for(const to of yTargets){const delta=to-y;if(Math.abs(delta)<bestY){bestY=Math.abs(delta);dy=delta;yGuide=to;}}
    if(bestX<threshold)target.left+=dx;if(bestY<threshold)target.top+=dy;
    if(xGuide!==null)lines.push({axis:"x",value:xGuide});if(yGuide!==null)lines.push({axis:"y",value:yGuide});
    state.snapLines=lines;drawGuides(lines);
  }
  function updateProperties() {
    const objects=activeObjects(),root=$("#properties-content");
    if(!objects.length){$("#properties-title").textContent="Page";$(".selection-dot").style.background="#8a8d7a";root.innerHTML=`<div class="properties-empty">Sélectionnez un élément pour le modifier, ou ajustez les paramètres de la page ci-dessous.</div><div class="page-settings"><div class="field"><label>Largeur (px)</label><input id="page-width" type="number" min="1" max="6000" value="${currentPage()?.width||1080}"></div><div class="field"><label>Hauteur (px)</label><input id="page-height" type="number" min="1" max="6000" value="${currentPage()?.height||1080}"></div><div class="field"><label>Fond</label><input id="page-prop-color" type="color" value="${currentPage()?.background?.startsWith("#")?currentPage().background:"#ffffff"}"></div><div class="quick-actions"><button id="save-template">Enregistrer comme modèle</button></div></div>`;
      $("#page-width").onchange=()=>resizePage(Math.max(1,Math.min(6000,Number($("#page-width").value))),currentPage().height);$("#page-height").onchange=()=>resizePage(currentPage().width,Math.max(1,Math.min(6000,Number($("#page-height").value))));$("#page-prop-color").oninput=(event)=>setBackground(event.target.value);$("#save-template").onclick=saveAsTemplate;return;
    }
    const object=objects[0],isText=["i-text","textbox","text"].includes(object.type),isImage=object.type==="image";
    $("#properties-title").textContent=objects.length>1?`${objects.length} éléments`:isText?"Texte":isImage?"Image":"Élément";$(".selection-dot").style.background="#c9a86a";
    let html=`<div class="property-group"><div class="property-title">POSITION & TAILLE</div><div class="field-row"><div class="field"><label>X</label><input data-prop="left" type="number" value="${Math.round(object.left)}"></div><div class="field"><label>Y</label><input data-prop="top" type="number" value="${Math.round(object.top)}"></div></div><div class="field-row"><div class="field"><label>Largeur</label><input data-prop="width" type="number" value="${Math.round(object.getScaledWidth())}"></div><div class="field"><label>Hauteur</label><input data-prop="height" type="number" value="${Math.round(object.getScaledHeight())}"></div></div><div class="field-row"><div class="field"><label>Rotation °</label><input data-prop="angle" type="number" value="${Math.round(object.angle||0)}"></div><div class="field"><label>Opacité %</label><input data-prop="opacityPercent" type="number" min="0" max="100" value="${Math.round((object.opacity??1)*100)}"></div></div><div class="quick-actions"><button data-action="duplicate">Dupliquer</button><button data-action="lock">${object.locked?"Déverrouiller":"Verrouiller"}</button><button data-action="delete">Supprimer</button></div></div>`;
    if(isText) html+=`<div class="property-group"><div class="property-title">TYPOGRAPHIE</div><div class="field"><label>Texte</label><textarea data-prop="text" rows="3" style="height:auto;resize:vertical">${escapeHTML(object.text||"")}</textarea></div><div class="field-row" style="margin-top:8px"><div class="field"><label>Police</label><select data-prop="fontFamily">${["Manrope","DM Sans","Georgia","Arial","Times New Roman","Courier New","Trebuchet MS","Verdana"].map(font=>`<option ${object.fontFamily===font?"selected":""}>${font}</option>`).join("")}</select></div><div class="field"><label>Corps px</label><input data-prop="fontSize" type="number" value="${Math.round(object.fontSize||32)}"></div></div><div class="field-row"><div class="field"><label>Couleur</label><input data-prop="fill" type="color" value="${colorValue(object.fill)}"></div><div class="field"><label>Alignement</label><select data-prop="textAlign"><option ${object.textAlign==="left"?"selected":""}>left</option><option ${object.textAlign==="center"?"selected":""}>center</option><option ${object.textAlign==="right"?"selected":""}>right</option></select></div></div><div class="quick-actions"><button data-action="bold">Gras</button><button data-action="italic">Italique</button><button data-action="underline">Souligné</button></div></div>`;
    else if(isImage) html+=`<div class="property-group"><div class="property-title">IMAGE</div><div class="field-row"><div class="field"><label>Luminosité</label><input data-prop="brightness" type="range" min="0" max="2" step=".1" value="${object.brightness??1}"></div><div class="field"><label>Contraste</label><input data-prop="contrast" type="range" min="0" max="2" step=".1" value="${object.contrast??1}"></div></div><div class="field-row"><div class="field"><label>Saturation</label><input data-prop="saturation" type="range" min="0" max="2" step=".1" value="${object.saturation??1}"></div><div class="field"><label>Coins arrondis</label><input data-prop="cornerRadius" type="number" min="0" max="100" value="${object.cornerRadius||0}"></div></div><div class="quick-actions"><button data-action="grayscale">Noir & blanc</button><button data-action="sepia">Sépia</button><button data-action="replace">Remplacer</button></div></div>`;
    else html+=`<div class="property-group"><div class="property-title">APPARENCE</div><div class="field-row"><div class="field"><label>Remplissage</label><input data-prop="fill" type="color" value="${colorValue(object.fill)}"></div><div class="field"><label>Bordure</label><input data-prop="stroke" type="color" value="${colorValue(object.stroke)}"></div></div><div class="field"><label>Épaisseur de bordure</label><input data-prop="strokeWidth" type="number" min="0" max="50" value="${object.strokeWidth||0}"></div></div>`;
    html+=`<div class="property-group"><div class="property-title">ORDRE DES CALQUES</div><div class="quick-actions"><button data-action="front">Tout devant</button><button data-action="forward">Monter</button><button data-action="backward">Descendre</button><button data-action="back">Tout derrière</button></div>${objects.length>1?'<div class="quick-actions"><button data-action="group">Grouper</button><button data-action="align-left">Aligner à gauche</button><button data-action="align-center">Centrer</button><button data-action="align-top">Aligner en haut</button></div>':object.type==="group"?'<div class="quick-actions"><button data-action="ungroup">Dégrouper</button></div>':""}</div>`;
    root.innerHTML=html;$$("[data-prop]",root).forEach(input=>input.addEventListener("input",()=>updateObject(input,objects)));
    $$("[data-action]",root).forEach(button=>button.onclick=()=>objectAction(button.dataset.action,objects));
  }
  function colorValue(value){return typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value)?value:"#293f39";}
  function updateObject(input,objects){
    const prop=input.dataset.prop,value=input.type==="number"||input.type==="range"?Number(input.value):input.value;
    for(const object of objects){
      if(prop==="width"){object.scaleX=value/(object.width||1);}
      else if(prop==="height"){object.scaleY=value/(object.height||1);}
      else if(prop==="opacityPercent"){object.opacity=Math.max(0,Math.min(100,value))/100;}
      else if(prop==="cornerRadius"){object.cornerRadius=value;object.clipPath=value?new fabric.Rect({width:object.width,height:object.height,rx:value,ry:value,originX:"center",originY:"center"}):null;}
      else if(["brightness","contrast","saturation"].includes(prop)){object[prop]=value;applyImagePreview(object);}
      else if(prop==="text"&&object.type==="i-text"){object.set("text",value);object.initDimensions();}
      else object.set(prop,value);
      object.setCoords();
    }
    state.canvas.requestRenderAll();snapshot();
  }
  function objectAction(action,objects) {
    const object=objects[0];
    if(action==="delete"){objects.forEach(item=>state.canvas.remove(item));state.canvas.discardActiveObject();snapshot();}
    else if(action==="duplicate"){objects.forEach(item=>item.clone(copy=>{copy.set({left:item.left+20,top:item.top+20,locked:false});state.canvas.add(copy);state.canvas.setActiveObject(copy);snapshot();},["src","cornerRadius","grayscale","sepia","brightness","contrast","saturation"]));}
    else if(action==="group"&&objects.length>1){state.canvas.getActiveObject().toGroup();snapshot();}
    else if(action==="ungroup"&&object.type==="group"){object.toActiveSelection();snapshot();}
    else if(action==="align-left"||action==="align-center"||action==="align-top"){const left=Math.min(...objects.map(item=>item.left)),top=Math.min(...objects.map(item=>item.top)),center=objects.reduce((sum,item)=>sum+item.left+item.getScaledWidth()/2,0)/objects.length;objects.forEach(item=>{if(action==="align-left")item.left=left;else if(action==="align-top")item.top=top;else item.left=center-item.getScaledWidth()/2;item.setCoords();});}
    else if(action==="lock"){objects.forEach(item=>{item.locked=!item.locked;applyLock(item);});snapshot();}
    else if(action==="front")objects.forEach(item=>state.canvas.bringToFront(item));
    else if(action==="back")objects.forEach(item=>state.canvas.sendToBack(item));
    else if(action==="forward")objects.forEach(item=>state.canvas.bringForward(item));
    else if(action==="backward")objects.forEach(item=>state.canvas.sendBackwards(item));
    else if(action==="bold")objects.forEach(item=>item.set("fontWeight",item.fontWeight==="bold"?"normal":"bold"));
    else if(action==="italic")objects.forEach(item=>item.set("fontStyle",item.fontStyle==="italic"?"normal":"italic"));
    else if(action==="underline")objects.forEach(item=>item.set("underline",!item.underline));
    else if(action==="grayscale")objects.forEach(item=>{item.grayscale=!item.grayscale;applyImagePreview(item);});
    else if(action==="sepia")objects.forEach(item=>{item.sepia=!item.sepia;applyImagePreview(item);});
    else if(action==="replace"){state.replaceTarget=object;$("#file-input").click();return;}
    state.canvas.requestRenderAll();snapshot();
  }
  function applyLock(object){object.set({lockMovementX:!!object.locked,lockMovementY:!!object.locked,lockScalingX:!!object.locked,lockScalingY:!!object.locked,lockRotation:!!object.locked,hasControls:!object.locked});}
  function renderLayers() {
    const root=$("#layers-section");if(!root||!state.canvas)return;
    const objects=state.canvas.getObjects().filter(object=>!object.isGuide).slice().reverse();
    root.innerHTML=`<div class="property-title">CALQUES <span>${objects.length}</span></div>`+objects.map(object=>`<div class="layer-row${state.canvas.getActiveObject()===object?" selected":""}"><button data-layer="toggle" data-id="${object.__uid|| (object.__uid=crypto.randomUUID())}" title="Afficher/masquer">${object.visible?"◉":"○"}</button><span class="layer-name" data-layer-select="${object.__uid}" title="${escapeHTML(object.text||object.type)}">${escapeHTML(object.text||object.type)}</span><div class="layer-controls"><button data-layer="up" data-id="${object.__uid}" title="Monter">↑</button><button data-layer="down" data-id="${object.__uid}" title="Descendre">↓</button></div></div>`).join("");
    $$("[data-layer-select]",root).forEach(node=>node.onclick=()=>{const object=state.canvas.getObjects().find(item=>item.__uid===node.dataset.layerSelect);if(object){state.canvas.setActiveObject(object);state.canvas.requestRenderAll();updateProperties();renderLayers();}});
    $$("[data-layer]",root).forEach(button=>button.onclick=()=>{const object=state.canvas.getObjects().find(item=>item.__uid===button.dataset.id);if(!object)return;if(button.dataset.layer==="toggle")object.visible=!object.visible;else if(button.dataset.layer==="up")state.canvas.bringForward(object);else state.canvas.sendBackwards(object);state.canvas.requestRenderAll();snapshot();});
  }
  function saveAsTemplate() {
    storeCurrentPage();const document={...state.project,id:`custom-${Date.now()}`,category:"Mes modèles",pages:state.project.pages,name:$("#project-name").value};
    fetch("/api/atelier/templates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(document)}).then(async response=>{if(!response.ok)throw new Error((await response.json()).detail||"Enregistrement refusé.");toast("Modèle ajouté à Mes modèles.");}).catch(error=>toast(error.message,true));
  }
  function captureThumbnail() {
    try {
      const source=state.canvas&&state.canvas.lowerCanvasEl;
      if(!source||!source.width)return null;
      const ratio=Math.min(1,320/Math.max(1,source.width));
      const off=document.createElement("canvas");off.width=Math.max(1,Math.round(source.width*ratio));off.height=Math.max(1,Math.round(source.height*ratio));
      off.getContext("2d").drawImage(source,0,0,off.width,off.height);
      return off.toDataURL("image/jpeg",0.82);
    } catch { return null; }
  }
  async function saveProject() {
    storeCurrentPage();state.project.name=$("#project-name").value.trim()||"Design sans titre";$("#save-status").textContent="Enregistrement…";
    try {const payload={...state.project,thumbnailDataUrl:captureThumbnail()};const response=await fetch("/api/atelier/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.detail||"Enregistrement impossible.");state.project=result;state.saved=true;$("#save-status").textContent="Enregistré";if(!new URL(location.href).searchParams.has("project"))history.replaceState(null,"",`/tools/portfolio-pdf?project=${encodeURIComponent(result.id)}`);toast("Projet enregistré.");}
    catch(error){$("#save-status").textContent="Erreur d’enregistrement";toast(error.message,true);}
  }
  async function exportProject(format) {
    storeCurrentPage();const button=$("#export-button");button.disabled=true;button.textContent="Préparation…";
    try {const response=await fetch(`/api/atelier/export/${format}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state.project)});if(!response.ok){const result=await response.json();throw new Error(result.detail||"L’export a échoué.");}const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`${(state.project.name||"design").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-")}.${format}`;link.click();URL.revokeObjectURL(url);toast(`${format.toUpperCase()} prêt à télécharger.`);}
    catch(error){toast(error.message,true);}finally{button.disabled=false;button.innerHTML="Exporter <span>⌄</span>";$("#export-menu").classList.remove("open");}
  }
  function historyMove(direction) {
    const index=state.historyIndex+direction;if(index<0||index>=state.history.length)return;
    state.historyIndex=index;state.restoring=true;const page=JSON.parse(state.history[index]);Object.assign(currentPage(),page);
    state.canvas.loadFromJSON({objects:page.objects,background:page.background},()=>{state.restoring=false;state.canvas.renderAll();updateProperties();renderLayers();markDirty();});
  }
  function keyboard(event) {
    const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey,editing=["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName);
    if(mod&&key==="s"){event.preventDefault();saveProject();return;}
    if(mod&&key==="z"){event.preventDefault();historyMove(event.shiftKey?1:-1);return;}
    if(mod&&(key==="y"||event.shiftKey&&key==="z")){event.preventDefault();historyMove(1);return;}
    if(mod&&key==="d"&&!editing){event.preventDefault();objectAction("duplicate",activeObjects());return;}
    if(mod&&key==="c"&&!editing&&activeObjects().length){event.preventDefault();state.clipboard=activeObjects().map(item=>item.toObject(["src","cornerRadius","grayscale","sepia","brightness","contrast","saturation","locked"]));return;}
    if(mod&&key==="v"&&!editing&&state.clipboard){event.preventDefault();fabric.util.enlivenObjects(state.clipboard,items=>{items.forEach(item=>addObject(item));});return;}
    if(editing||!state.canvas)return;
    if((event.key==="Delete"||event.key==="Backspace")&&activeObjects().length){event.preventDefault();objectAction("delete",activeObjects());}
    else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)&&activeObjects().length){event.preventDefault();const step=event.shiftKey?10:1;for(const object of activeObjects()){if(event.key==="ArrowLeft")object.left-=step;if(event.key==="ArrowRight")object.left+=step;if(event.key==="ArrowUp")object.top-=step;if(event.key==="ArrowDown")object.top+=step;object.setCoords();}state.canvas.requestRenderAll();snapshot();}
    else if(event.code==="Space"){state.spaceDown=true;$("#canvas-viewport").style.cursor="grab";}
  }
  function init() {
    if(state.initialized)return;state.initialized=true;
    if(typeof fabric==="undefined"){toast("Fabric.js n’a pas pu être chargé.",true);return;}
    $$(".tool-tab[data-tab]").forEach(button=>button.onclick=()=>setPanel(button.dataset.tab));
    $("#panel-close").onclick=()=>$("#left-panel").classList.toggle("closed");
    $("#save-project").onclick=saveProject;$("#project-name").oninput=markDirty;$("#undo").onclick=()=>historyMove(-1);$("#redo").onclick=()=>historyMove(1);
    $("#zoom-in").onclick=()=>setZoom(state.zoom*1.12);$("#zoom-out").onclick=()=>setZoom(state.zoom/1.12);$("#zoom-fit").onclick=fitCanvas;
    $("#export-button").onclick=()=>$("#export-menu").classList.toggle("open");$$("[data-format]").forEach(button=>button.onclick=()=>exportProject(button.dataset.format));
    $("#add-page").onclick=()=>addPage(false);$("#prev-page").onclick=()=>changePage(-1);$("#next-page").onclick=()=>state.pageIndex<state.project.pages.length-1?changePage(1):addPage(false);
    $("#duplicate-page").onclick=()=>addPage(true);$("#rename-page").onclick=renamePage;$("#delete-page").onclick=deletePage;$("#move-page-left").onclick=()=>movePage(-1);$("#move-page-right").onclick=()=>movePage(1);
    $("#grid-toggle").onclick=()=>{state.grid=!state.grid;$("#grid-overlay").classList.toggle("visible",state.grid);};$("#safe-toggle").onclick=()=>{state.safe=!state.safe;$("#safe-margin").classList.toggle("visible",state.safe);};
    $("#file-input").onchange=(event)=>{if(state.replaceTarget&&event.target.files[0]){const file=event.target.files[0],form=new FormData();form.append("file",file);fetch("/api/atelier/uploads",{method:"POST",body:form}).then(response=>response.json()).then(result=>{if(result.detail)throw new Error(result.detail);    fabric.Image.fromURL(result.url,image=>{const old=state.replaceTarget;image.set({left:old.left,top:old.top,scaleX:old.getScaledWidth()/image.width,scaleY:old.getScaledHeight()/image.height,angle:old.angle,opacity:old.opacity,cornerRadius:old.cornerRadius,brightness:old.brightness,contrast:old.contrast,saturation:old.saturation,grayscale:old.grayscale,sepia:old.sepia,src:result.url,_positionExplicit:true});applyImagePreview(image);state.canvas.remove(old);addObject(image);state.replaceTarget=null;});}).catch(error=>toast(error.message,true));}else uploadFiles(event.target.files);event.target.value="";};
    document.addEventListener("keydown",keyboard);document.addEventListener("keyup",(event)=>{if(event.code==="Space"){state.spaceDown=false;$("#canvas-viewport").style.cursor="";}});
    let panStart=null;$("#canvas-viewport").addEventListener("pointerdown",event=>{if(state.spaceDown){panStart={x:event.clientX,y:event.clientY,left:event.currentTarget.scrollLeft,top:event.currentTarget.scrollTop};event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.style.cursor="grabbing";}});
    $("#canvas-viewport").addEventListener("pointermove",event=>{if(panStart){event.currentTarget.scrollLeft=panStart.left-(event.clientX-panStart.x);event.currentTarget.scrollTop=panStart.top-(event.clientY-panStart.y);}});
    $("#canvas-viewport").addEventListener("pointerup",()=>{panStart=null;$("#canvas-viewport").style.cursor="";});
    $("#canvas-viewport").addEventListener("wheel",event=>{if(event.ctrlKey){event.preventDefault();setZoom(state.zoom*(event.deltaY<0?1.06:.94));}},{passive:false});
    $("#canvas-viewport").addEventListener("dragover",event=>event.preventDefault());
    $("#canvas-viewport").addEventListener("drop",event=>{event.preventDefault();if(event.dataTransfer.files.length)uploadFiles(event.dataTransfer.files);});
    window.addEventListener("resize",()=>{if(state.zoom<1)fitCanvas();});
    window.addEventListener("beforeunload",event=>{if(!state.saved){event.preventDefault();event.returnValue="";}});
    state.autoSave=window.setInterval(()=>{if(!state.saved)saveProject();},30000);
    const config=window.EDITOR_CONFIG||{};
    if(config.projectId)loadProject(config.projectId);else if(config.templateId)openTemplate(config.templateId);else{state.project.pages=[{width:1080,height:1080,background:"#ffffff",objects:[]}];setPage(state.project.pages[0]);}
    setPanel("templates");
  }
  async function loadProject(id) {
    try {const response=await fetch(`/api/atelier/projects/${encodeURIComponent(id)}`);if(!response.ok)throw new Error((await response.json()).detail||"Projet introuvable.");state.project=await response.json();state.project.pages=state.project.pages||[state.project];$("#project-name").value=state.project.name||"Design sans titre";state.saved=true;$("#save-status").textContent="Enregistré";setPage(state.project.pages[0],0);}
    catch(error){toast(error.message,true);state.project.pages=[{width:1080,height:1080,background:"#ffffff",objects:[]}];setPage(state.project.pages[0]);}
  }
  window.AtelierEditor={init,destroy(){if(state.autoSave)window.clearInterval(state.autoSave);if(state.canvas)state.canvas.dispose();state.initialized=false;}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
})();
