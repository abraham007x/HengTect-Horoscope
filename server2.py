from flask import Flask, request, jsonify
import torch, cv2
import numpy as np
from torchvision import transforms, models
from PIL import Image
import mediapipe as mp
from flask_cors import CORS
import requests
import os
import gdown
from flask import send_from_directory


app = Flask(__name__)
CORS(app)

score_map = {0: 2, 1: 4, 2: 6, 3: 8, 4: 10}

LANDMARKS = {
    "การงาน": list(range(65, 85)),
    "การเงิน": list(range(4, 8)) + list(range(94, 100)),
    "ความรัก": list(range(78, 88)) + list(range(308, 318)),
    "สุขภาพ": list(range(234, 356)),
    "คุ้มครอง": list(range(152, 171)),
}

def load_model(path):
    model = models.resnet34(weights=None)
    model.fc = torch.nn.Linear(model.fc.in_features, 5)
    model.load_state_dict(torch.load(path, map_location='cpu'))
    model.eval()
    return model


def download_model(url, local_path):
    if not os.path.exists(local_path):
        print(f"🔽 กำลังโหลดโมเดล: {local_path}")
        gdown.download(url, local_path, quiet=False)

# โหลดจาก Google Drive
download_model("https://drive.google.com/uc?id=160WTbJ82GPvtDkgV4y2k8lM3rccOurGB", "model_work.pth")
download_model("https://drive.google.com/uc?id=1CsPGHNYvyCy_E8Ab6J3KfnrSBJCudNIo", "model_money.pth")
download_model("https://drive.google.com/uc?id=1OP3PIMPtIq2-JStBdQFo_vFybkVgQEik", "model_love.pth")
download_model("https://drive.google.com/uc?id=1S_8aY_Wpxu3oCgzo0jPSNq7OESbSd-N4", "model_health.pth")
download_model("https://drive.google.com/uc?id=1AsJgsoy1VMfiAGQT9zFErb1fuYUy5-w4", "model_protect.pth")


models_dict = {
    "การงาน": load_model("model_work.pth"),
    "การเงิน": load_model("model_money.pth"),
    "ความรัก": load_model("model_love.pth"),
    "สุขภาพ": load_model("model_health.pth"),
    "คุ้มครอง": load_model("model_protect.pth")
}



transform = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor()])

@app.route('/predict', methods=['POST'])
def predict():
    file = request.files['image']
    image = Image.open(file.stream).convert('RGB')
    image_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    h, w = image_bgr.shape[:2]

    face_mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1)
    results = face_mesh.process(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks:
        return jsonify({"error": "ไม่พบใบหน้า"}), 400

    landmarks = results.multi_face_landmarks[0].landmark
    featureScores = {}

    for label, model in models_dict.items():
        pts = np.array([(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in LANDMARKS[label]])
        x, y, ww, hh = cv2.boundingRect(pts)
        crop = image_bgr[max(y-10,0):y+hh+10, max(x-10,0):x+ww+10]

        if crop.size == 0:
            featureScores[label] = 0
            continue

        img = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
        input_tensor = transform(img).unsqueeze(0)
        with torch.no_grad():
            pred = model(input_tensor).argmax().item()
            featureScores[label] = score_map[pred]

    return jsonify({"featureScores": featureScores})

# Gemini API key ควรเก็บใน environment variable
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("No Gemini API key set in environment variable GEMINI_API_KEY")

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

@app.route('/generate_horoscope', methods=['POST'])
def generate_horoscope():
    data = request.json
    score = data.get("score")
    zodiac = data.get("zodiac")
    deity_name = data.get("deity", "องค์เทพที่เหมาะสม")


    if not score or not zodiac:
        return jsonify({"error": "ข้อมูลไม่ครบ"}), 400

    prompt = f"""
คุณคือหมอดู AI ผู้เชี่ยวชาญด้านการวิเคราะห์ดวงชะตา โดยอาศัยการผสมผสานระหว่างศาสตร์โหงวเฮ้งและราศี  
คุณได้รับข้อมูลของผู้ใช้ซึ่งอยู่ในราศี {zodiac} พร้อมคะแนนวิเคราะห์ใบหน้าจาก 5 จุดสำคัญตามหลักโหงวเฮ้ง ได้แก่  
- คิ้ว (การงาน): {score.get("การงาน", 0)}
- จมูก (การเงิน): {score.get("การเงิน", 0)}
- ปาก (ความรัก): {score.get("ความรัก", 0)}
- แก้ม (สุขภาพ): {score.get("สุขภาพ", 0)}
- คาง (คุ้มครอง): {score.get("คุ้มครอง", 0)}

โปรดวิเคราะห์ภาพรวมของดวงชะตาผู้นี้โดยสังเคราะห์ข้อมูลจากทั้งสองศาสตร์  
ให้คำทำนายมีลักษณะเป็นทางการ เหมือนหมอดูผู้มีประสบการณ์กำลังบอกเล่าอย่างรอบคอบและมีหลักการ  
ควรแสดงถึงจุดเด่น จุดควรระวัง แนวโน้มของชีวิต และแนะนำแนวทางที่เหมาะสมสำหรับเสริมดวงไม่ต้องบอกคะเเนนที่เป็นตัวเลขเลยนะ ถ้าคะเเนนเยอะก็บแกเป็นภาษาพูดเอาให้พิจารณาดูเอาเลยครับ

โปรดระบุด้วยว่า “องค์เทพที่เหมาะสมในการบูชาเพื่อเสริมดวงของผู้นี้คือ {deity_name}”  
และกล่าวถึงพลังขององค์เทพนั้นอย่างน่าเลื่อมใส พร้อมแนะแนวทางการบูชาหรือวัตถุมงคลที่ควรพิจารณา

คำทำนายทั้งหมดให้อยู่ในรูปแบบข้อความเดียว ความยาวประมาณ 10–11 บรรทัด  
เน้นภาษาที่งดงาม มีความศักดิ์สิทธิ์ เหมาะสมกับการเป็นคำทำนายจากหมอดูผู้มีวิชา"""
    


    


    try:
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ]
        }
        headers = {
            "Content-Type": "application/json"
        }

        resp = requests.post(GEMINI_URL, json=body, headers=headers)
        resp.raise_for_status()

        response_data = resp.json()
        result = response_data['candidates'][0]['content'] if 'candidates' in response_data and response_data['candidates'] else "ไม่มีคำตอบจาก AI"

        return jsonify({"result": result})

    except Exception as e:
        print("❌ Gemini API ERROR:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/')
def serve_index():
    return send_from_directory('static', 'index1.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

