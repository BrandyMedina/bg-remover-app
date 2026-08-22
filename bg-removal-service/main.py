from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from rembg import remove, new_session
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
import io

# Crea una aplicacion de FastAPI para manejar peticiones HTTP
app = FastAPI()

# Se Cargan ambos modelos una sola vez al arrancar el servidor
sessions = {
    "product": new_session("u2net"),            # para fotos solo de producto
    "model": new_session("u2net_human_seg"),     # para fotos con mano/persona
}

def clean_alpha_edges(image_bytes: bytes, threshold: int = 128, erode_pixels: int = 2, blur_radius: float = 1.5) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:,:,3]

    #Se binariza lo que hace que elimine halos y sombras semi-transparentes
    binary_alpha = alpha > threshold
    #Encoge la mascara y podria dejar color residual de la sombra
    eroded = ndimage.binary_erosion(binary_alpha, iterations = erode_pixels)
    eroded_alpha = np.where(eroded, 255, 0).astype(np.uint8)
    #Suaviza el borde ya limpio y ayuda a que no se vea pixelado
    alpha_img = Image.fromarray(eroded_alpha,"L")
    smoothed_alpha = alpha_img.filter(ImageFilter.GaussianBlur(radius= blur_radius))

    arr[:,:,3] = np.array(smoothed_alpha)

    result = Image.fromarray(arr, "RGBA")
    output = io.BytesIO()
    result.save(output, format="PNG")
    return output.getvalue()




@app.post("/remove-bg")
async def remove_background(
    file: UploadFile = File(...),
    mode: str = Form("product")  # "product" o "model", "product" por defecto
):
    if mode not in sessions:
        mode = "product"  # fallback seguro si se manda algo invalido

    input_bytes = await file.read()
    output_bytes = remove(input_bytes, session=sessions[mode])
    output_bytes= clean_alpha_edges(output_bytes)

    return StreamingResponse(
        io.BytesIO(output_bytes),
        media_type="image/png"
    )

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "bg-removal"}