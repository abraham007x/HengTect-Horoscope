// ✅ script.model_based.js — เวอร์ชันที่ลบการคำนวณแบบ landmark และใช้โมเดลแทน พร้อมแก้ mapping คะแนนรวม
(async () => {
  const [metrics, horData, sacredData] = await Promise.all([
    fetch('face_metrics.json').then(r => r.json()),
    fetch('horoscope_parsed.json').then(r => r.json()),
    fetch('sacred_data.json').then(r => r.json())
  ]);

  const labels = ['การงาน', 'การเงิน', 'ความรัก', 'สุขภาพ', 'คุ้มครอง'];
  const faceToZodiacAspect = {
    'คิ้ว': 'การงาน',
    'จมูก': 'การเงิน',
    'ปาก': 'ความรัก',
    'แก้ม': 'สุขภาพ',
    'คาง': 'คุ้มครอง'
  };

  const labelWithFace = labels.map(label => {
    const feature = Object.entries(faceToZodiacAspect).find(([, v]) => v === label)?.[0];
    return feature ? `${label} (${feature})` : label;
  });

  const ctx = document.getElementById('radarChart').getContext('2d');
  const radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labelWithFace,
      datasets: []
    },
    options: {
      scales: {
        r: {
          min: 0,
          max: 40,
          ticks: {
            stepSize: 8,
            display: false
          },
          grid: {
            color: 'rgba(255, 215, 0, 0.5)'  // 🟡 เส้นตารางสีทอง
          },
          angleLines: {
            color: 'rgba(255, 215, 0, 0.7)' // 🟡 เส้นรอบวงสีทอง
          },
          pointLabels: {
            color: '#5d4037', // ชื่อแต่ละแกนสีน้ำตาล
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false,
          labels: {
            color: '#5d4037',
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        }
      }
    }
  });

  const videoEl = document.getElementById('input_video');
  const faceMesh = new FaceMesh({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
  faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
  let isScanning = false;

  const canvas = document.getElementById("overlayCanvas");
  const ctxOverlay = canvas.getContext("2d");

function resizeOverlayToVideo() {
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
}

  
  

  faceMesh.onResults(results => {
  console.log("FaceMesh called"); // 👈 ลองดูว่ามีแสดงมั้ยใน DevTools

  resizeOverlayToVideo();  // ✅ ใส่ไว้ตรงนี้ทุกครั้งก่อนวาด
  ctxOverlay.clearRect(0, 0, canvas.width, canvas.height);

  if (isScanning) {
    // ✅ วาดกรอบตรงกลาง
ctxOverlay.clearRect(0, 0, canvas.width, canvas.height);
  ctxOverlay.strokeStyle = "rgb(255, 255, 255)";
  ctxOverlay.lineWidth = 1.5;
  ctxOverlay.setLineDash([4, 2]); // เส้นประ
  ctxOverlay.strokeRect(160, 80, 320, 320);
  ctxOverlay.setLineDash([]); // ล้างหลังวาด



    // ✅ วาดจุด landmark
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      for (const landmarks of results.multiFaceLandmarks) {
        for (const point of landmarks) {
          const x = point.x * canvas.width;
          const y = point.y * canvas.height;

          ctxOverlay.beginPath();
ctxOverlay.arc(x, y, 1.5, 0, 2 * Math.PI);
ctxOverlay.fillStyle = "deepskyblue";
ctxOverlay.fill();
        }
      }
    }
  }
});

  function clearSnapshot() {
    document.querySelectorAll("canvas.snapshot").forEach(c => c.remove());
    if (videoEl) videoEl.style.display = 'block';
    const removeBtn = document.getElementById("btnRemoveImage");
    if (removeBtn) removeBtn.remove();
  }

  function showRemoveButton() {
    let removeBtn = document.getElementById("btnRemoveImage");
    if (!removeBtn) {
      removeBtn = document.createElement("button");
      removeBtn.id = "btnRemoveImage";
      removeBtn.textContent = "🗑 ลบรูปภาพ";
      removeBtn.style.marginTop = "1rem";
      removeBtn.onclick = () => {
      location.reload();
      };


     
      document.getElementById("controls").appendChild(removeBtn);
      const loading = document.getElementById("loadingIndicator");
      if (loading) loading.style.display = "block";

    }
  }

  async function analyzeFaceWithModel(canvas) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    const formData = new FormData();
    formData.append('image', blob, 'face.jpg');
    const res = await fetch('/predict', {
    method: 'POST',
    body: formData});
    return await res.json();
  }



  function getDescriptionsFromScores(scores, metrics) {
    const descs = {};
    for (const [aspect, score] of Object.entries(scores)) {
      const feature = Object.entries(faceToZodiacAspect).find(([k, v]) => v === aspect)?.[0];
      const featObj = metrics.features.find(f => f.name === feature);
      descs[feature] = featObj?.descriptions?.[score.toString()] || "❌ ไม่มีคำทำนาย";
    }
    return descs;
  }

  async function onFaceResults(results) {
    const canvas = document.querySelector("canvas.snapshot");
    if (!canvas) return alert("❌ ไม่พบภาพ snapshot");

    const { featureScores } = await analyzeFaceWithModel(canvas);
    const descs = getDescriptionsFromScores(featureScores, metrics);
    console.log("📊 คะแนนโหงวเฮ้งจากโมเดล:", featureScores);

    window.__faceFeatureScores = featureScores;
    window.__faceFeatureDescriptions = descs;

    const faceDiv = document.getElementById('faceResults');
    faceDiv.innerHTML = `<h2>🧠 คำทำนายโหงวเฮ้ง 🧠 </h2>`;

    renderFaceSummary(descs);
    document.getElementById('btnHoroscope').disabled = false;
  }



  function renderFaceSummary(descriptions) {
    const container = document.getElementById("faceSummaryContainer");
    container.innerHTML = "";

    const scoreFromFace = window.__faceFeatureScores || {};
    const partToLabel = {
      "คิ้ว": "การงาน",
      "จมูก": "การเงิน",
      "ปาก": "ความรัก",
      "แก้ม": "สุขภาพ",
      "คาง": "คุ้มครอง"
    };

    for (const [part, fullText] of Object.entries(descriptions)) {
      const summary = fullText.split(":")[0]?.trim() || "-";
      const detail = fullText.split(":").slice(1).join(":").trim();

      const box = document.createElement("div");
      box.className = "face-summary";

      box.innerHTML = `
      <p><strong>${part}</strong>:${renderPowerScale(scoreFromFace[partToLabel[part]] || 0)}</p>
      <button class="toggle-detail" onclick="this.nextElementSibling.classList.toggle('hidden-detail')">
        อ่านคำทำนายเพิ่มเติม
      </button>
      <div class="hidden-detail hidden-detail">${detail}</div>
    `;

      container.appendChild(box);
    }
  }






  document.getElementById('btnHoroscope').onclick = async () => {
    const bd = document.getElementById('birthdate').value;
    if (!bd) return alert("กรุณาเลือกวันเกิด");
    const [dayStr, monthStr, yearStr] = bd.split('/');
    const d = new Date(`${yearStr}-${monthStr}-${dayStr}`);
    const m = d.getMonth() + 1;
    const day = d.getDate();

    const zodiacs = [
      ['มังกร', [1, 15], [2, 12]], ['กุมภ์', [2, 13], [3, 14]], ['มีน', [3, 15], [4, 13]],
      ['เมษ', [4, 14], [5, 14]], ['พฤษภ', [5, 15], [6, 14]], ['เมถุน', [6, 15], [7, 14]],
      ['กรกฎ', [7, 15], [8, 14]], ['สิงห์', [8, 15], [9, 16]], ['กันย์', [9, 17], [10, 16]],
      ['ตุลย์', [10, 17], [11, 15]], ['พิจิก', [11, 16], [12, 14]], ['ธนู', [12, 16], [1, 14]]
    ];

    const inRange = (month, day, [startM, startD], [endM, endD]) => {
      const val = month * 100 + day;
      const start = startM * 100 + startD;
      const end = endM * 100 + endD;
      return start <= end ? val >= start && val <= end : val >= start || val <= end;
    };

    let zodiac = 'ไม่ทราบ';
    for (let [name, start, end] of zodiacs) {
      if (inRange(m, day, start, end)) {
        zodiac = name;
        break;
      }
    }

    const hor = horData.find(h => (h.ราศี || '').trim().split(' ')[0] === zodiac) || {};
    renderZodiacSummary(hor);

    const scoreFromFace = window.__faceFeatureScores || {};

    const finalScores = labels.map(label => {
      const sZodiac = Number(hor['คะแนน' + label]) || 0;
      const sFace = Number(scoreFromFace[label]) || 0;
      return sZodiac + sFace;
    });

    console.log("📊 คะแนนจากดวง:", labels.map(label => Number(hor['คะแนน' + label]) || 0));
    console.log("📊 คะแนนจากโหงวเฮ้ง:", labels.map(label => Number(scoreFromFace[label]) || 0));
    console.log("🎯 คะแนนรวมเฉลี่ย (finalScores):", finalScores);
    // console.log("🚀 กำลังส่งข้อมูลไป Gemini...");



    document.getElementById('zodiacResult').innerHTML = `<h2> ราศีของคุณคือ ${zodiac}</h2>`;

    const horoDiv = document.getElementById('horoscopeResult');
    horoDiv.innerHTML = `<h2> คำทำนายราศี</h2>`;
    //      

    radarChart.data.datasets = [{
      label: 'ก่อนบูชาเทพ',
      data: finalScores,
      backgroundColor: 'rgba(186, 104, 200, 0.3)',  // ม่วงอ่อน
      borderColor: 'rgba(123, 31, 162, 1)',         // ม่วงเข้ม
      pointBackgroundColor: 'rgba(123, 31, 162, 1)'

    }];
    radarChart.update();


    // ✅ เตรียมข้อมูลส่งไป Gemini API
    const scoreObj = {};
    labels.forEach((label, i) => {
      scoreObj[label] = finalScores[i];
    });

    try {

      const weakestLabel = labels[finalScores.indexOf(Math.min(...finalScores))];

      let bestDeity = null, maxBoost = -Infinity;
      for (let deity of sacredData) {
        const boost = deity[weakestLabel] || 0;
        if (boost > maxBoost) {
          maxBoost = boost;
          bestDeity = deity;
        }
      }

     const response = await fetch("/generate_horoscope", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ score: scoreObj, zodiac, deity: bestDeity?.ชื่อ || "" })
});

      const data = await response.json();

      // ✅ แสดงผลคำทำนายจาก AI
      document.getElementById('aiHoroscopeResult').innerHTML = `
    <div class="popup-box show" style="margin-top:1rem;">
      <h3>🌟 คำทำนายจากหมอดู  Gemie 🌟</h3>
      <p style="white-space: pre-wrap;">${data.result.parts?.[0]?.text || "ไม่มีคำทำนายจาก AI"}</p>
    </div>
  `;
    } catch (err) {
      console.error("❌ เรียก AI ไม่สำเร็จ:", err);
    }








    const scoreSumText = labels.map((label, i) => {
      const z = Number(hor['คะแนน' + label]) || 0;
      const f = Number(scoreFromFace[label]) || 0;
      return `<li><b>${label}</b>: <b>${z + f}</b> คะแนน</li>`;
    }).join('');




    const btnDiv = document.getElementById('deityButtons');


    const weakestLabel = labels[finalScores.indexOf(Math.min(...finalScores))];
    const matchFeature = Object.entries(faceToZodiacAspect).find(([_, v]) => v === weakestLabel)?.[0];
    const descFromFace = (window.__faceFeatureDescriptions || {})[matchFeature] || '';

    let bestDeity = null, maxBoost = -Infinity;
    for (let deity of sacredData) {
      const boost = deity[weakestLabel] || 0;
      if (boost > maxBoost) {
        maxBoost = boost;
        bestDeity = deity;
      }
    }

    if (bestDeity) {
      const deityTip = document.getElementById("deityTip");
      deityTip.innerHTML = `
  <h3>✨ คำแนะนำพิเศษ ✨</h3>
  <p>แนะนำให้บูชา <b>${bestDeity.ชื่อ}</b></p>
  <img src="image/${bestDeity.image}" alt="${bestDeity.ชื่อ}" style="width:100%; border-radius:12px;">
  <p><i>${bestDeity.ความหมาย}</i></p>
  <p>ดวง+โหงวเฮ้งด้านที่คุณควรเสริมคือ <b>${weakestLabel}</b></p>
`;
      deityTip.style.display = "block";
    }

    sacredData.forEach(de => {
      const btn = document.createElement('button');
      btn.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <span>${de.ชื่อ}</span>
          <img src="image/${de.image}" alt="${de.ชื่อ}" style="width: 80px; height: auto; margin-top: 4px;">
        </div>
      `;
      btn.onclick = () => {
        const boosted = labels.map((k, i) => finalScores[i] + (de[k] || 0));
        radarChart.data.datasets = radarChart.data.datasets.filter(d => !d.label.startsWith('หลังบูชา'));
        radarChart.data.datasets.push({
          label: `หลังบูชา ${de.ชื่อ}`,
          data: boosted,
          backgroundColor: 'rgba(255, 215, 0, 0.4)',
          borderColor: 'rgba(255, 193, 7, 1)',
          pointBackgroundColor: 'rgba(255, 193, 7, 1)'

        });
        radarChart.update();








        const deityChosenBox = document.getElementById("deityChosen");
        if (deityChosenBox) {
          deityChosenBox.innerHTML = `
    <h3>🌟 เทพที่คุณเลือก 🌟</h3>
    <p><b>${de.ชื่อ}</b></p>
    <img src="image/${de.image}" alt="${de.ชื่อ}" style="width:100%; border-radius:12px;">
    <p><i>${de.ความหมาย}</i></p>
    <p style="margin-top: 1rem; font-style: italic;">คุณเลือกองค์เทพนี้เพื่อเสริมพลังชีวิตในแบบของคุณเอง</p>

  `;
        }

        document.querySelectorAll('.recommended-product').forEach(item => item.remove());
        const productDiv = document.createElement('div');
        productDiv.innerHTML = `
          <h3>🛍️ สินค้าแนะนำจาก Tiny Little Toys</h3>
          <a href="${de.productLink}" target="_blank">คลิกที่นี่เพื่อดูสินค้า ${de.ชื่อ}</a>
        `;
        productDiv.classList.add('recommended-product');
        productDiv.style.marginTop = "10px";
        btnDiv.appendChild(productDiv);
      };
      btnDiv.appendChild(btn);
    });
  };

  // ✅ เพิ่ม input file ซ่อนไว้
  const inputUpload = document.createElement('input');
  inputUpload.type = 'file';
  inputUpload.accept = 'image/*';
  inputUpload.id = 'uploadImage';
  inputUpload.style.display = 'none';
  document.getElementById('controls').appendChild(inputUpload);

  // ✅ ปุ่มอัปโหลดรูป
  const btnUpload = document.createElement('button');
  btnUpload.textContent = "📁 อัปโหลดรูป";
  btnUpload.onclick = () => inputUpload.click();
  document.getElementById('controls').appendChild(btnUpload);

  // ✅ เมื่อผู้ใช้เลือกภาพ
  inputUpload.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
      clearSnapshot();
      const canvas = document.createElement('canvas');
      canvas.classList.add("snapshot");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      if (videoEl) videoEl.style.display = 'none';
      videoEl.insertAdjacentElement('afterend', canvas);
      onFaceResults();  // ✅ เพิ่มบรรทัดนี้เพื่อให้แสดงคำทำนาย
      faceMesh.send({ image: canvas });
      showRemoveButton();
    };
    img.src = URL.createObjectURL(file);
  };

  const btnScan = document.createElement('button');
  btnScan.textContent = "📷 เริ่มสแกนใบหน้า";
  btnScan.onclick = scanOnce;
  document.getElementById('controls').prepend(btnScan);



  const btnReset = document.createElement('button');
  btnReset.textContent = "🔄 ถ่ายใหม่ 🔄";
  btnReset.style.display = 'none';
  btnReset.onclick = scanOnce;
  document.getElementById('controls').appendChild(btnReset);

  async function scanOnce() {
  clearSnapshot();
  isScanning = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoEl.srcObject = stream;

    // ✅ รอ video metadata เพื่อให้ width/height พร้อมก่อนใช้
    await new Promise(resolve => {
      videoEl.onloadedmetadata = () => {
        resizeOverlayToVideo(); // 👈 ทำตรงนี้ จะได้ขนาดถูก
        resolve();
      };
    });

    await videoEl.play();

    if (window.__camera__) window.__camera__.stop();

    window.__camera__ = new Camera(videoEl, {
      onFrame: async () => {
        if (isScanning) await faceMesh.send({ image: videoEl });
      },
      width: 640,
      height: 480,
    });
    window.__camera__.start();

    // document.getElementById('faceResults').innerHTML =
    //   `<p style="color: lime; text-align: center; font-weight: bold;">📸 กำลังเตรียมสแกนใบหน้า กรุณาหันหน้าตรง</p>`;

    setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.classList.add("snapshot");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx2d = canvas.getContext('2d');
      ctx2d.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      // ctx2d.strokeStyle = 'lime';
      // ctx2d.lineWidth = 4;
      // ctx2d.strokeRect(canvas.width / 4, canvas.height / 4, canvas.width / 2, canvas.height / 2);
      // ctx2d.fillStyle = 'lime';
      // ctx2d.font = '20px sans-serif';
      // ctx2d.fillText("✓ สแกนสำเร็จ", canvas.width / 3, 30);

      stream.getTracks().forEach(t => t.stop());
      isScanning = false;
      videoEl.srcObject = null;
      videoEl.style.display = 'none';
      ctxOverlay.clearRect(0, 0, canvas.width, canvas.height);  // ✅ ลบกรอบและจุดทั้งหมด


      videoEl.insertAdjacentElement('afterend', canvas);
      faceMesh.send({ image: canvas });
      onFaceResults();  // ✅ เพิ่มบรรทัดนี้

      btnReset.style.display = 'inline-block';
      showRemoveButton();
    }, 7000);

  } catch (err) {
    alert("❌ ไม่สามารถเปิดกล้องได้: " + err.message);
  }
}



  
  function showPopupLine(container, title, content, delay = 600) {
    const box = document.createElement('div');
    box.className = 'popup-box';
    box.innerHTML = `<b>${title}</b><br>${content}`;
    container.appendChild(box);
    setTimeout(() => box.classList.add('show'), 10);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  function showPopupInPairs(entries, container) {
    const grid = document.createElement('div');
    grid.className = 'popup-grid';
    container.appendChild(grid);

    const delay = 800;
    const render = async () => {
      for (let i = 0; i < entries.length; i += 2) {
        const batch = entries.slice(i, i + 2);
        const promises = batch.map(([title, content]) =>
          showPopupLine(grid, `🔹 ${title}`, content, 0)
        );
        await Promise.all(promises);
        await new Promise(r => setTimeout(r, delay));
      }
    };
    render();
  }





 function renderPowerScale(score) {
    const filled = Math.round(score / 2);
    const empty = 5 - filled;
    return '<span style="font-size:2rem; color:gold;">★</span>'.repeat(filled) +
      '<span style="font-size:2rem; color:gold;">☆</span>'.repeat(empty);
  }


  function renderZodiacSummary(horoscopeData) {
    const container = document.getElementById("zodiacBoxesContainer");
    container.innerHTML = "";

    const aspects = ["การงาน", "การเงิน", "ความรัก", "สุขภาพ", "คุ้มครอง"];

    for (const aspect of aspects) {
      const scoreKey = "คะแนน" + aspect;
      const score = horoscopeData[scoreKey];
      const text = horoscopeData[aspect];

      const box = document.createElement("div");
      box.className = "face-summary";  // ใช้คลาสเดียวกับกล่องโหงวเฮ้ง

      box.innerHTML = `
      <p><strong>${aspect}</strong>: ${renderPowerScale(score)}</p>
      <button class="toggle-detail" onclick="this.nextElementSibling.classList.toggle('hidden-detail')">
        อ่านคำทำนายเพิ่มเติม
      </button>
      <div class="hidden-detail">${text}</div>
    `;

      container.appendChild(box);
    }
  }

  document.getElementById('prevBtn2').addEventListener('click', () => {
    location.reload();
});





})();
