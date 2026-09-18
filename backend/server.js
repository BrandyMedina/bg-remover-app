const express = require("express"); //framework del servidor web 
const multer = require("multer");  //maneja la subida de archivos que son las imagenes desde el front
const axios = require("axios");   //hace peticiones HTTP hacia otros servidores (Hacia el servidor de python)
const FormData = require("form-data"); //arma el paquete de datos tipo formulario que se necesita mandar al microservicio de python
const sharp = require("sharp"); //Procesa imagenes(funciona para el color del background)
const cors = require("cors");  //Permite que el front pueda hacer peticiones a este backend sin que el navegador la bloquee

// Crea aplicacion del servidor 
const app = express();
app.use(cors());   //Activa CORS para todas las rutas

const upload = multer({ storage: multer.memoryStorage()} );        //Configura multer para guardar los archivos en memoria RAM
const BG_REMOVAL_SERVICE_URL = "http://localhost:8000/remove-bg"; //Direccion de microservicio de Python 

const TARGET_SIZE = 1080;  //tamaño estandar de la imagen 

// Funcion que llama al microservicio de Python
async function removeBackground(imageBuffer, originalName, mode){
    const form = new FormData();
    form.append("file", imageBuffer, originalName);
    form.append("mode", mode);

    const response = await axios.post(BG_REMOVAL_SERVICE_URL, form,{
        headers: form.getHeaders(),
        responseType: "arraybuffer" //especifica que se esperan recibir datos binarios no texto
    });

    return Buffer.from(response.data) 
}

async function fitToCanvas(transparentPngBuffer){
    const resized = await sharp(transparentPngBuffer).resize(TARGET_SIZE, TARGET_SIZE,{
        fit: "contain",
        background: {r:0, g:0, b:0, alpha:0 },
    })
    .png()
    .toBuffer()

    return resized;
}

//Endpoint principal 
app.post("/process-images", upload.array("images"), async (req,res)=>{
    try{
        // Valores por defecto
        const mode = req.body.mode || "product";
        const color = req.body.color || "#ffffff";

        // Si no llega ningun archivo resgresa un error 400
        if(!req.files || req.files.length === 0){
            return res.status(400).json({error:"No se recibieron imagenes"});
        }

        const results = await Promise.all(
            req.files.map(async(file) => {
                const transparentBuffer = await removeBackground(
                    file.buffer,
                    file.originalname,
                    mode
                );
                const finalBuffer = await fitToCanvas(transparentBuffer);

                return{
                    originalName: file.originalname,
                    image: finalBuffer.toString("base64") //imagen con transparencia
                };
            })
        );

        res.json({results})
    }catch(error){
        console.error("Error procesando imagenes",error.message);
        res.status(500).json({error: "Error al procesar las imagenes"});
    }
});

// Endpoint de para saber que todo esta bien 
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});

