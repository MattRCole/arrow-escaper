import { useState } from 'react'
import './App.css'
import { Stage, Layer, Rect } from 'react-konva';

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Stage width={window.innerWidth} height={window.innerHeight}>
        <Layer>
          <Rect
            x={20}
            y={20}
            width={100}
            height={100}
            fill="red"
            draggable />

        </Layer>

      </Stage>
    </>
  )
}

export default App
