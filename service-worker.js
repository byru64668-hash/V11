const CACHE_NAME = "schooltrack-eapihs-v2";
const ASSETS = ["./","./index.html","./style.css","./app.js","./admin.js","./firebase.js","./manifest.json","./assets/schooltrack-icon.png","./assets/icon-192.png","./assets/icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin===location.origin)event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));return response;}).catch(()=>caches.match("./index.html"))));
});
