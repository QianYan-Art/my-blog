(function() {
  var dateEl = document.getElementById('footDate');
  if (dateEl) {
    var d = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateEl.textContent = String(d.getDate()).padStart(2,'0') + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  // Grid overlay
  var gridCanvas = document.getElementById('grid-overlay');
  if (gridCanvas) {
    var gCtx = gridCanvas.getContext('2d');
    var currentGrid = 'G1'; // 默认开启 G1 点阵网格

    function resizeCanvas() {
      gridCanvas.width  = window.innerWidth;
      gridCanvas.height = window.innerHeight;
      drawGrid(currentGrid);
    }

    function drawGrid(type) {
      currentGrid = type;
      var w = gridCanvas.width, h = gridCanvas.height;
      gCtx.clearRect(0, 0, w, h);
      if (type === 'none') return;

      if (type === 'G1') {
        var spacing = 20;
        gCtx.fillStyle = 'rgba(40,25,10,0.18)';
        for (var x = spacing; x < w; x += spacing) {
          for (var y = spacing; y < h; y += spacing) {
            gCtx.beginPath(); gCtx.arc(x, y, 0.6, 0, Math.PI * 2); gCtx.fill();
          }
        }
      } else if (type === 'G2') {
        gCtx.strokeStyle = 'rgba(60,35,15,0.08)'; gCtx.lineWidth = 0.75;
        for (var y = 28; y < h; y += 28) {
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(w, y); gCtx.stroke();
        }
      } else if (type === 'G3') {
        gCtx.strokeStyle = 'rgba(40,25,10,0.07)'; gCtx.lineWidth = 0.5;
        for (var x = 24; x < w; x += 24) {
          gCtx.beginPath(); gCtx.moveTo(x, 0); gCtx.lineTo(x, h); gCtx.stroke();
        }
        for (var y = 24; y < h; y += 24) {
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(w, y); gCtx.stroke();
        }
      } else if (type === 'G4') {
        var sp = 60, arm = 5;
        gCtx.strokeStyle = 'rgba(40,25,10,0.20)'; gCtx.lineWidth = 1;
        for (var x = sp; x < w; x += sp) {
          for (var y = sp; y < h; y += sp) {
            gCtx.beginPath(); gCtx.moveTo(x - arm, y); gCtx.lineTo(x + arm, y); gCtx.stroke();
            gCtx.beginPath(); gCtx.moveTo(x, y - arm); gCtx.lineTo(x, y + arm); gCtx.stroke();
          }
        }
      } else if (type === 'G5') {
        for (var y = 20; y < h; y += 20) {
          var thick = (y % 80 === 0);
          gCtx.strokeStyle = thick ? 'rgba(40,25,10,0.10)' : 'rgba(40,25,10,0.055)';
          gCtx.lineWidth   = thick ? 0.8 : 0.5;
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(w, y); gCtx.stroke();
        }
      } else if (type === 'G6') {
        var divX = Math.round(w * 0.35);
        gCtx.strokeStyle = 'rgba(40,25,10,0.07)'; gCtx.lineWidth = 0.6;
        for (var y = 28; y < h; y += 28) {
          gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(divX, y); gCtx.stroke();
        }
        gCtx.strokeStyle = 'rgba(181,57,45,0.30)'; gCtx.lineWidth = 1;
        gCtx.beginPath(); gCtx.moveTo(divX, 0); gCtx.lineTo(divX, h); gCtx.stroke();
      }
    }

    window.addEventListener('resize', resizeCanvas);
    if (document.readyState === 'complete') {
      resizeCanvas();
    } else {
      window.addEventListener('load', resizeCanvas);
    }
  }
})();
