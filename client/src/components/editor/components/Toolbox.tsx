import React, { ChangeEventHandler, FormEventHandler, useEffect, useRef, useState } from 'react';
import { useUpdate } from '../../../hooks/common';
import { observe, sceneSettings } from '../settings';
import './Toolbox.scss';
import { Switch, Radio, RadioChangeEvent, Select, Slider, Button } from 'antd';
import { getCanvas } from '../utils/canvas';
import { sceneStorage } from '../store';
import { loadFile } from '../utils/Files';

const { Option } = Select;

export default function Toolbox() {

  const update = useUpdate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState('move');
  const [editMode, setEditMode] = useState('sculpt');
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [textures, setTextures] = useState<({ name: string, url: string, type: 'albedo' | 'normal' | 'displace' })[]>([]);


  function updateTextures() {

    const textures = sceneStorage.getAllTextures();
    const urls = [];
    for (let name in textures) {

      const url = URL.createObjectURL(textures[name].image);
      urls.push({ name, url, type: textures[name].type });

    }

    setTextures(urls);

  }

  async function loadTexture(type: 'normal' | 'albedo' | 'displace') {
    const file = await loadFile('image/*');
    sceneStorage.saveTexture(file.name, {
      image: file,
      type,
      width: 0,
      height: 0,
    });
    updateTextures();
  }

  useEffect(() => {

    observe(() => {

      let _1 = sceneSettings.currentTool;
      let _2 = sceneSettings.sculpt;
      let _3 = sceneSettings.global.showBVHHelper;
      let _4 = sceneSettings.global.subdivision;
      let _5 = sceneSettings.paint;
      let { roughness, metalness } = sceneSettings.paint;
      let _7 = sceneSettings.scene;

    }, () => {

      if (canvasRef.current) {

        if (sceneSettings.currentTool === 'paint') {

          setCanvasVisible(true);

        } else {

          setCanvasVisible(false);

        }

      }
      update();

    });
    sceneStorage.onChange((key: string) => {

      if (key === 'textures') {
        updateTextures();
      }

    });

    const cvs = getCanvas();

    let ctx: CanvasRenderingContext2D | null = null;

    if (canvasRef.current) {

      ctx = canvasRef.current.getContext('2d');

    }

    function copyCanvas() {

      if (sceneSettings.currentTool === 'paint') {

        ctx?.drawImage(cvs, 0, 0, 170, 100);

      }

      requestAnimationFrame(copyCanvas);

    }

    copyCanvas();

  }, []);

  function handleModeChange(e: RadioChangeEvent) {

    const mode = e.target.value;

    if (mode === 'browse') {

      sceneSettings.currentTool = '';

    } else if (mode === 'edit') {

      sceneSettings.currentTool = 'sculpt';

    } else {

      sceneSettings.currentTool = mode;

    }

    setMode(mode);

  }


  function handleEditModeChange(mode: string) {

    sceneSettings.currentTool = mode;

    setEditMode(mode);

  }

  return <div
    className='toolbox-container'
    onMouseDown={e => e.stopPropagation()}
  // onMouseUp={e => e.stopPropagation()}
  >
    <div className='toolbox-title'>Tool</div>
    <div className='toolbox-body'>

      <div className='toolbox-folder'>
        <Radio.Group size='small' value={mode} style={{ width: '100%' }} onChange={handleModeChange}>
          <Radio.Button style={{ width: '33%', textAlign: 'center' }} value="browse">Browse</Radio.Button>
          <Radio.Button style={{ width: '33%', textAlign: 'center' }} value="move">Move</Radio.Button>
          <Radio.Button style={{ width: '33%', textAlign: 'center' }} value="edit">Edit</Radio.Button>
          <Radio.Button style={{ width: '33%', textAlign: 'center' }} value="paint">Paint</Radio.Button>
        </Radio.Group>
      </div>

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Input/Output</div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.importModel++}>Load Model</Button>
        </div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.saveTo3DTiles++}>Generate 3DTiles</Button>
        </div>
      </div>

      {
        mode === 'paint' &&
        <div className='toolbox-outfolder'>
          <div className='toolbox-outfolder-title'>Paint Options</div>
          <div className='toolbox-folder'>
            <span>Draw on vertex</span>
            <Switch
              defaultChecked={sceneSettings.paint.verticeColor}
              size='small'
              onChange={checked => sceneSettings.paint.verticeColor = checked}
            />
          </div>
          <div className='toolbox-folder'>
            <span>Close Path</span>
            <Switch
              defaultChecked={sceneSettings.paint.closePath}
              size='small'
              onChange={checked => sceneSettings.paint.closePath = checked}
            />
          </div>
          <div className='toolbox-folder'>
            <span>Draw Color</span>
            <input
              type="color"
              defaultValue={'#' + sceneSettings.paint.color.toString(16)}
              onChange={e => {
                const color = e.target.value;
                const hex = Number('0x' + color.substring(1));
                sceneSettings.paint.color = hex;
              }} />
          </div>
          <div className='toolbox-folder'>
            <div>Roughness</div>
            <Slider style={{ flexGrow: 1 }} value={sceneSettings.paint.roughness} step={0.01} min={0} max={1} onChange={value => sceneSettings.paint.roughness = value} />
          </div>
          <div className='toolbox-folder'>
            <div>Metalness</div>
            <Slider style={{ flexGrow: 1 }} value={sceneSettings.paint.metalness} step={0.01} min={0} max={1} onChange={value => sceneSettings.paint.metalness = value} />
          </div>
          <div className='toolbox-outfolder'>
            <div className='toolbox-outfolder-title'>Textures</div>
            <div className='toolbox-folder'>
              {
                textures.length ? textures.map((t) => {
                  const sign = t.type === 'albedo' ? 'T' : t.type === 'normal' ? 'N' : 'D';

                  return <div
                    className='toolbox-texture-img'
                    key={t.name}
                  >
                    <span>{sign}</span>
                    <img
                      src={t.url}
                      onClick={e => {
                        sceneSettings.action.applyTexture = '';
                        sceneSettings.action.applyTexture = t.name;
                      }}>
                    </img>
                  </div>
                }) : null
              }
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => loadTexture('albedo')}>Import Texture</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => loadTexture('normal')}>Import Normal</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => loadTexture('displace')}>Import Displace</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.loadTexturesInScene++}>Load All Textures</Button>
            </div>
          </div>
        </div>
      }
      {
        mode === 'edit' &&
        <div className='toolbox-outfolder'>
          <div className='toolbox-outfolder-title'>Edit Options</div>
          <div className='toolbox-folder'>
            <Select
              size='small'
              defaultValue="sculpt" style={{ width: '100%' }} onChange={handleEditModeChange}>
              <Option value="sculpt">Sculpt</Option>
              <Option value="addvertex">Add Vertex</Option>
              <Option value="addface">Add Face</Option>
              <Option value="deletevertex">Delete Face</Option>
            </Select>
          </div>
          {
            mode === 'edit' && editMode === 'sculpt' &&
            <>
              <div className='toolbox-folder'>
                <span>Brush Type</span>
                <Select
                  size='small'
                  defaultValue="flatten" style={{ width: '90px' }} onChange={e => sceneSettings.sculpt.brush = e}>
                  <Option value="flatten">Flatten</Option>
                  <Option value="clay">Clay</Option>
                  <Option value="normal">Normal</Option>
                </Select>
              </div>
              <div className='toolbox-folder'>
                <div>Intensity</div><Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.sculpt.intensity} min={10} max={150} onChange={value => sceneSettings.sculpt.intensity = value} />
              </div>
            </>
          }
        </div>
      }

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Visual Helpers</div>
        <div className='toolbox-folder'>
          <span>BVH Bounds</span>
          <Switch size='small'
            onChange={checked => {
              sceneSettings.global.showBVHHelper = checked
            }}
          />
        </div>
        {
          sceneSettings.global.showBVHHelper && <div className='toolbox-folder'>
            <div>BVH Depth</div><Slider style={{ flexGrow: 1 }} defaultValue={5} min={1} max={25} onChange={value => sceneSettings.global.BVHHelperDepth = value} />
          </div>
        }

        <div className='toolbox-folder'>
          <span>Octree Nodes</span><Switch defaultChecked={sceneSettings.global.showOctreeHelper} size='small' onChange={checked => sceneSettings.global.showOctreeHelper = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>Mesh Edges</span><Switch defaultChecked={sceneSettings.global.showMeshEdge} size='small' onChange={checked => sceneSettings.global.showMeshEdge = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>ME DepthTest</span><Switch defaultChecked={sceneSettings.global.meshEdgeDepthTest} size='small' onChange={checked => sceneSettings.global.meshEdgeDepthTest = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>Bounding Box</span><Switch defaultChecked={sceneSettings.global.showBoundingBox} size='small' onChange={checked => sceneSettings.global.showBoundingBox = checked} />
        </div>
      </div>

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Scene Options</div>
        <div className='toolbox-folder'>
          <span>Live Select</span><Switch defaultChecked={sceneSettings.scene.liveSelect} size='small' onChange={checked => sceneSettings.scene.liveSelect = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>Enable Shadow</span><Switch defaultChecked={sceneSettings.scene.castShadow} size='small' onChange={checked => sceneSettings.scene.castShadow = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>Light Helper</span><Switch defaultChecked={sceneSettings.scene.showLightHelper} size='small' onChange={checked => sceneSettings.scene.showLightHelper = checked} />
        </div>
        <div className='toolbox-folder'>
          <div>ShadowMap Size</div>
          <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.shadowMapResolution} min={500} max={10000} onChange={value => sceneSettings.scene.shadowMapResolution = value} />
        </div>
        <div className='toolbox-folder'>
          <div>Light Angle</div>
          <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.lightAngle} min={0} max={180} onChange={value => sceneSettings.scene.lightAngle = value} />
        </div>
        <div className='toolbox-folder' >
          <div>Light Direction</div>
          <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.lightDirection} min={0} max={360} onChange={value => sceneSettings.scene.lightDirection = value} />
        </div>
        <div className='toolbox-folder'>
          <div>Light Distance</div>
          <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.lightDistance} min={10} max={1000} onChange={value => sceneSettings.scene.lightDistance = value} />
        </div>
        <div className='toolbox-folder'>
          <div>Light Intensity</div>
          <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.lightIntensity} step={0.1} min={0} max={20} onChange={value => sceneSettings.scene.lightIntensity = value} />
        </div>
        <div className='toolbox-folder'>
          <div>AmbLight Intensity</div>
          <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.lightIntensity} step={0.1} min={0} max={20} onChange={value => sceneSettings.scene.lightIntensity = value} />
        </div>
        <div className='toolbox-folder'>
          <span>Axis Helper</span><Switch defaultChecked={sceneSettings.scene.showAxisHelper} size='small' onChange={checked => sceneSettings.scene.showAxisHelper = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>BG Color</span>
          <input
            type="color"
            defaultValue={'#' + sceneSettings.scene.backgroundColor.toString(16)}
            onChange={e => {
              const color = e.target.value;
              const hex = Number('0x' + color.substring(1));
              sceneSettings.scene.backgroundColor = hex;
            }} />
        </div>
      </div>

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Geometry Options</div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.global.subdivision++}>Subdivision</Button>
        </div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.global.simplification++}>Simplification</Button>
        </div>
      </div>
      <div className='toolbox-outfolder' style={{ display: canvasVisible ? 'block' : 'none' }}>
        <div className='toolbox-outfolder-title'>Texture Preview</div>
        <canvas ref={canvasRef} width='170px' height='100px' style={{ backgroundColor: '#afafaf', width: '100%' }} />
      </div>
    </div>
  </div>
}

