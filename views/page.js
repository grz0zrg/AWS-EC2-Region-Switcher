var showOverlay = function () {
  var overlay = document.createElement('div')
  var flex = document.createElement('div')
  overlay.className = 'overlay'
  flex.innerText = 'switching region, please wait...'
  overlay.appendChild(flex)
  document.body.appendChild(overlay)
}
