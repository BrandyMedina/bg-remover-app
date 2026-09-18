import { useEffect, useRef, useState } from "react";
import "./App.css";

const PRESET_COLORS = ["#ffffff", "#f0f0f0", "#000000"];
const CANVAS_SIZE = 1080;

function drawComposite(ctx, img, color, position){
  ctx.clearRect(0,0, CANVAS_SIZE,CANVAS_SIZE);
  ctx.fillStyle = color;
  ctx.fillRect(0,0, CANVAS_SIZE, CANVAS_SIZE);

  const drawWidth = CANVAS_SIZE * position.scale;
  const drawHeight = CANVAS_SIZE * position.scale;
  
  const dx = (CANVAS_SIZE - drawWidth)/2 + position.x;
  const dy = (CANVAS_SIZE - drawHeight)/2 + position.y;

  ctx.drawImage(img, dx, dy, drawWidth,drawHeight);
}

function renderFinalImage(imageBase64, color, position){
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      drawComposite(ctx, img, color, position);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = `data:image/png;base64,${imageBase64}`
  });
}

function ResultCanvas({imageBase64, color, position, size = 220}){
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img =  new Image();
    img.onload = () => drawComposite(ctx, img, color, position);
    img.src = `data:image/png;base64,${imageBase64}`;
  }, [imageBase64,color, position]);

  return(
    <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{width: size, height: size}} className="result-canvas" />
  );
}

function ImageEditor({result, onSave, onCancel}){
  const canvasRef = useRef(null);
  const [position, setPosition] = useState(result.position);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({x: 0, y: 0, posX: 0, posY: 0});
  const displaySize = 380;
  const scaleFactor = CANVAS_SIZE / displaySize;

  useEffect(() =>{
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => drawComposite(ctx, img, result.color, position);
    img.src = `data:image/png;base64,${result.image}`;
  }, [position, result.image, result.color]);

  const handleMouseDown = (e) => {
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleMouseMove = (e) => {
    if(!dragging) return;
    const deltaX = (e.clientX - dragStart.current.x) * scaleFactor;
    const deltaY =(e.clientY - dragStart.current.y) * scaleFactor;
    setPosition((prev) => ({
      ...prev,
      x: dragStart.current.posX + deltaX,
      y: dragStart.current.posY + deltaY,
    }));
  };

  const handleMouseUp = () => setDragging(false);

  const handleZoomChange = (e) => {
    setPosition((prev) => ({ ...prev, scale: parseFloat(e.target.value)}));
  };

  return(
    <div className="editor-overlay">
      <div className="editor-box">
        <h3>Ajustar Imagen</h3>
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} 
        style={{width:displaySize, height: displaySize, cursor: dragging ? "grabbing" : "grab"}}
        className="editor-canvas" onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        />
        <label className="field-label">Zoom</label>
        <input type="range" min= "0.5" max= "3" step="0.05"
        value={position.scale} onChange={handleZoomChange} className="zoom-slider" 
        />
        <div className="editor-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={() => onSave(position)}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  // Estados de los componentes
  const [mode, setMode] = useState("model");
  const [color, setColor] = useState("#ffffff");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [editingIndex, setEditingIndex] = useState(null);
  


  // Funcion que se ejecuta cuando el usuario elige archivos con el selector normal
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setPreviews(selectedFiles.map((file) => URL.createObjectURL(file)));
  };

  // Funcion que se ejecuta cuando el usuario suelta archivos arrastrados sobre el dropzone
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
    setPreviews(droppedFiles.map((file) => URL.createObjectURL(file)));
  };

  //Es necesario para permitir el drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Funcion que se asegura de que si esta vacio no se procese nada y cuando haya algo pueda procesarse
  const processImages = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    // Todos los datos que son requeridos por el usuario para poder editar y generar la imagen
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    formData.append("mode", mode);
    formData.append("color", color);

    try {
      const response = await fetch("http://localhost:3000/process-images", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      const enriched = (data.results || []).map((r) => ({
        ...r,
        color,
        position:{ x:0, y:0, scale:1},
      }));
      setResults(enriched);
    } catch (error) {
      console.error("Error al procesar imagenes: ", error);
      alert(
        "Hubo un error al procesar las imagenes. Revisa que el backend este corriendo",
      );
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (index) => {
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  };

  const downloadImage = async (result) => {
    const dataUrl = await renderFinalImage(result.image, result.color, result.position);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = result.originalName.replace(/\.[^/.]+$/, "") + "_procesada.png";
    link.click();
  };

  const saveEdit = (newPosition) =>{
    setResults((prev) => prev.map((r,i) => (i === editingIndex ? {...r, position: newPosition} :r))
  );
  setEditingIndex(null);
  };


  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">BG Remover</h1>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="card">
            <h3>Tipo de imagen</h3>
            <div className="toggle-group">
              <button
                className={mode === "model" ? "toggle-btn active" : "toggle-btn"}
                onClick={() => setMode("model")}
              >
                Modelo
              </button>
              <button
                className={mode === "product" ? "toggle-btn active" : "toggle-btn"}
                onClick={() => setMode("product")}
              >
                Producto
              </button>
            </div>
          </section>
          

          <section className="card">
            <h3>Fondo personalizado</h3>
            <label className="field-label"> Color de Fondo</label>
            <div className="color-row">
              {PRESET_COLORS.map((present) => (
                <button
                  key={present}
                  className={
                    color === present ? "color-swatch active" : "color-swatch"
                  }
                  style={{background: present}}
                  onClick={() => setColor(present)}
                />
              ))}
              <label className="color-swatch custom-color">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
            </div>
          </section>

          <button
            className="process-btn"
            onClick={processImages}
            disabled={files.length === 0 || processing}
          >
            {processing
              ? "Procesando..."
              : `Procesar ${files.length} imagen(es)`}
          </button>
        </aside>

        <main className="main-area">
          <section className="dropzone-section">
            <div
              className="dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                id="file-input"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <label htmlFor="file-input" className="dropzone-label">
                <div className="upload-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
                    <path d="M7 9l5 -5l5 5" />
                    <path d="M12 4l0 12" />
                  </svg>
                </div>
                <div className="dropzone-tittle">Sube tus imágenes</div>
                <div className="dropzone-subtitle">
                  Arrastra y suelta multiples archivos aquí, o haz clic para
                  seleccionar.
                  {files.length > 0 && `(${files.length} seleccionadas)`}
                </div>
              </label>
            </div>
          </section>

          {previews.length > 0 && (
            <section className="preview-section">
              <h3>Imágenes seleccionadas</h3>
              <div className="preview-grid">
                {previews.map((src, i)=> (
                  <div className="preview-thumb" key={i}>
                    <img src={src} alt={files[i]?.name} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* {results.length > 0 && (
            <section className="preview-section">
              <h3>Imagenes Seleccionadas</h3>
              <div className="preview-grid">
                {previews.map((src, i) => (
                  <div className="preview-thumb" key={i}>
                    <img src={src} alt={files[i]?.name} />
                  </div>
                ))}
              </div>
            </section>
          )} */}

          {results.length > 0 && (
            <section className="results-section">
              <div className="results-header">
                <h3>Resultados recientes</h3>
                <button className="link-btn" onClick={selectAll}>
                  {selected.size === results.length
                    ? "Deselecionar todo"
                    : "Seleccionar todo"}
                </button>
              </div>

              <div className="results-grid">
                {results.map((result, i) => (
                  <div className="result-card" key={i}>
                    <div className="result-image-wrapper">
                      <input
                        type="checkbox"
                        className="result-checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleSelect(i)}
                      />
                      <ResultCanvas imageBase64={result.image}
                      color = {result.color} position = {result.position}
                      />
                    </div>
                    <div className="result-actions">
                      <button className="edit-btn" onClick={() => setEditingIndex(i)}> Editar </button>

                      <button
                        className="download-btn"
                        onClick={() => downloadImage(result)}
                      >
                        Descargar
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="currentColor" className="icon icon-tabler icons-tabler-filled icon-tabler-download">
                          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                          <path d="M20 16a1 1 0 0 1 1 1v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2a1 1 0 0 1 2 0v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1 -1v-2a1 1 0 0 1 1 -1m-8 -13a1 1 0 0 1 1 1v9.585l3.293 -3.292a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1 -.09 .08l.09 -.08a1 1 0 0 1 -.674 .292l-.033 .001h-.032l-.054 -.004l.086 .004a1 1 0 0 1 -.617 -.213a1 1 0 0 1 -.09 -.08l-5 -5a1 1 0 0 1 1.414 -1.414l3.293 3.292v-9.585a1 1 0 0 1 1 -1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {editingIndex !== null && (
        <ImageEditor result={results[editingIndex]} onSave={saveEdit}
        onCancel={() => setEditingIndex(null)}
        />
      )}
      <footer className="footer">
        <p>&copy; 2026 BG Remover Website</p>
      </footer>
    </div>
  );
}

export default App;
