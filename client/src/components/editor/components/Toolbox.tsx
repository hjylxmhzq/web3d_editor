import React, { ChangeEventHandler, FormEventHandler, useEffect, useRef, useState } from 'react';
import { useUpdate } from '../../../hooks/common';
import { observe, sceneSettings, TextureType } from '../settings';
import './Toolbox.scss';
import { Switch, Radio, RadioChangeEvent, Select, Slider, Button, Table, Progress, Popconfirm } from 'antd';
import { getCanvas } from '../utils/canvas';
import { sceneStorage } from '../store';
import { loadFile } from '../utils/Files';
import { loadOnlineTexture } from '../../api/io';
import { getAllScene } from '../../api/vertionControl';

const { Option } = Select;

export default function Toolbox() {

  const update = useUpdate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState(sceneSettings.currentTool);
  const [editMode, setEditMode] = useState(sceneSettings.edit.type);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [textures, setTextures] = useState<({ name: string, url: string, type: TextureType })[]>([]);
  const [scenes, setScenes] = useState<string[]>(['None']);
  const [infoTable, setInfoTable] = useState<{ columns: any[], data: any[] }>({ columns: [], data: [] });


  function updateTextures() {

    const textures = sceneStorage.getAllTextures();
    const urls = [];
    for (let name in textures) {

      const url = URL.createObjectURL(textures[name].image);
      urls.push({ name, url, type: textures[name].type });

    }

    urls.sort();

    setTextures(urls);

  }

  function onBufferTypeChange() {

    const current = sceneSettings.scene.logarithmicDepthBuffer;
    sceneSettings.scene.logarithmicDepthBuffer = !current;
    window.location.reload();

  }

  function onSecondCameraToggle() {

    const current = sceneSettings.scene.secondCamera;
    sceneSettings.scene.secondCamera = !current;
    window.location.reload();

  }

  async function loadTexture() {
    const file = await loadFile('image/*');
    sceneStorage.saveTexture(file.name, {
      image: file,
      type: sceneSettings.paint.importTextureType,
      width: 0,
      height: 0,
    });
    updateTextures();
  }

  useEffect(() => {

    (async () => {

      const textures = await loadOnlineTexture();

      for (let texture of textures) {
        sceneStorage.saveTexture(texture.name, {
          image: texture.image,
          type: texture.type,
          width: 0,
          height: 0,
        });
      }
      updateTextures();

      const scenes = await getAllScene();
      scenes.unshift('None');
      setScenes(scenes);

    })();

    observe(() => {
      let _1 = sceneSettings.text.currentUserData;
    }, () => {

      const userData = sceneSettings.text.currentUserData;

      const columns = [
        {
          title: 'key',
          dataIndex: 'key',
          width: 80,
          ellipsis: true,
        },
        {
          title: 'value',
          dataIndex: 'value',
          width: 100,
          ellipsis: true,
        }
      ];

      const data = Object.entries(userData).map(([key, value]) => {
        return {
          key,
          value,
        }
      });

      setInfoTable({ columns, data });

    });

    observe(() => {

      let _1 = sceneSettings.currentTool;
      let _2 = sceneSettings.sculpt;
      let _3 = sceneSettings.global.showBVHHelper;
      let _4 = sceneSettings.global.subdivision;
      let _5 = sceneSettings.paint;
      let { roughness, metalness } = sceneSettings.paint;
      let _7 = sceneSettings.scene;
      let { x, y, z, type } = sceneSettings.transform;
      let _8 = sceneSettings.transform.type;
      let _9 = sceneSettings.edit;
      let _10 = sceneSettings.paint.importTextureType;
      let _11 = sceneSettings.scene.baseMapCenterLat;
      let _12 = sceneSettings.scene.baseMapCenterLng;
      let _15 = sceneSettings.scene.showBaseMap;
      let _13 = sceneSettings.text.loading;
      let _14 = sceneSettings.text.loadingText;

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

      ctx?.clearRect(0, 0, 170, 100);
      ctx?.drawImage(cvs, 0, 0, 170, 100);

      requestAnimationFrame(copyCanvas);

    }

    copyCanvas();

  }, []);

  function handleTextureTypeChange(v: TextureType) {

    sceneSettings.paint.importTextureType = v;

  }

  function handleModeChange(e: RadioChangeEvent) {

    const mode = e.target.value;

    sceneSettings.currentTool = mode;

    setMode(mode);

  }


  function handleEditModeChange(mode: string) {

    sceneSettings.edit.type = mode;

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
          <Radio.Button style={{ width: '33%', textAlign: 'center' }} value="create">Object</Radio.Button>
        </Radio.Group>
      </div>

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Tiles Scene</div>
        <div className='toolbox-folder'>
          <span>Scene: </span>
          <Select
            size='small'
            defaultValue={sceneSettings.action.selectScene}
            style={{ width: '100%' }}
            onChange={v => {
              sceneSettings.action.selectScene = v
            }}
          >
            {
              scenes.map(s => {
                return <Option value={s}>{s}</Option>
              })
            }
          </Select>
        </div>
      </div>

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Input/Output</div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.importModel++}>Load Model</Button>
        </div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.importGeoJson++}>Load GeoJSON</Button>
        </div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.exportSceneToGltf++}>Export Scene</Button>
        </div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.exportSelectedToGltf++}>Export Selected</Button>
        </div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.saveTo3DTiles++}>Generate 3DTiles</Button>
        </div>
        <div className='toolbox-folder'>
          <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.commitVersion++}>Commit Version</Button>
        </div>
      </div>

      {
        sceneSettings.text.loading !== -1 ?
          <div className='toolbox-outfolder'>
            <div className='toolbox-outfolder-title'>Tasks</div>
            <div className='toolbox-folder'>
              <span>{sceneSettings.text.loadingText}</span>
              <Progress percent={sceneSettings.text.loading * 100 >> 0} size="small" />
            </div>
          </div>
          : null
      }

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Mesh Information</div>
        <div className='toolbox-folder'>
          <span>World X:</span>
          <input
            type='number'
            onChange={e => sceneSettings.transform.x = parseFloat(e.target.value)}
            value={sceneSettings.transform.x}
            style={{
              width: 100,
              height: 25,
              border: 'none'
            }} />
        </div>
        <div className='toolbox-folder'>
          <span>World Y:</span>
          <input
            type='number'
            onChange={e => sceneSettings.transform.y = parseFloat(e.target.value)}
            value={sceneSettings.transform.y}
            style={{
              width: 100,
              height: 25,
              border: 'none'
            }} />
        </div>
        <div className='toolbox-folder'>
          <span>World Z:</span>
          <input
            type='number'
            onChange={e => sceneSettings.transform.z = parseFloat(e.target.value)}
            value={sceneSettings.transform.z}
            style={{
              width: 100,
              height: 25,
              border: 'none'
            }} />
        </div>
      </div>

      {
        mode === 'create' &&
        <>
          <div className='toolbox-outfolder'>
            <div className='toolbox-outfolder-title'>Geometry Pools</div>
            <div className='toolbox-folder'>
              {
                ['sphere', 'box', 'plane', 'cone'].map(geo => {
                  return <Button
                    size='small'
                    style={{ width: '49%' }}
                    key={geo}
                    onClick={e => {
                      sceneSettings.action.createGeometry = '';
                      sceneSettings.action.createGeometry = geo;
                    }}>
                    {geo}
                  </Button>
                })
              }
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.deleteGeometry++}>Delete Geometry</Button>
            </div>
          </div>

          <div className='toolbox-outfolder'>
            <div className='toolbox-outfolder-title'>Mesh Tools</div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.global.subdivision++}>Subdivision</Button>
            </div>
            <div className='toolbox-folder'>
              <span>Simple Subdivision</span>
              <Switch
                defaultChecked={sceneSettings.edit.simpleSubdivision}
                size='small'
                onChange={checked => sceneSettings.edit.simpleSubdivision = checked}
              />
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.global.simplification++}>Simplification</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.editBoundary++}>Edit Vertices</Button>
            </div>
            <div className='toolbox-folder'>
              <span>Edit Mode</span>
              <Select
                size='small'
                defaultValue={sceneSettings.edit.verticesEditMode} style={{ width: '60%' }} onChange={v => sceneSettings.edit.verticesEditMode = v}>
                <Option value="edge">Edge</Option>
                <Option value="vertical_edge">Vertical Edge</Option>
                <Option value="vertex">Vertex</Option>
              </Select>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.mergeGeometries++}>Merge Seleted</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.dulplicateMesh++}>Dulplicate Seleted</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.recomputeCenter++}>Recompute Center</Button>
            </div>
          </div>

          <div className='toolbox-outfolder'>
            <div className='toolbox-outfolder-title'>CSG Tools</div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.unionGeometries++}>Union</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.intersectGeometries++}>Intersect</Button>
            </div>
          </div>
        </>
      }
      {
        mode === 'move' &&
        <div className='toolbox-outfolder'>
          <div className='toolbox-outfolder-title'>Transform Options</div>
          <div className='toolbox-folder'>
            <Select
              size='small'
              defaultValue={sceneSettings.transform.type} style={{ width: '100%' }} onChange={v => sceneSettings.transform.type = v}>
              <Option value="translate">Translate</Option>
              <Option value="rotate">Rotate</Option>
              <Option value="scale">Scale</Option>
            </Select>
          </div>
        </div>
      }
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
            <div className='toolbox-folder' style={{ maxHeight: 300, overflow: 'auto' }}>
              {
                textures.length ? textures.map((t) => {
                  const sign = t.type.substring(0, 1).toUpperCase() + t.type.substring(1);

                  return <div
                    className='toolbox-texture-img'
                    key={t.name}
                  >
                    <span>{sign}</span>
                    <img
                      title={t.name}
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
              <Button size='small' style={{ width: '100%' }} onClick={e => loadTexture()}>Import Texture</Button>
            </div>
            <div className='toolbox-folder'>
              <span>Type</span>
              <Select
                size='small'
                style={{ width: '120px' }}
                defaultValue={sceneSettings.paint.importTextureType}
                onChange={handleTextureTypeChange}>
                <Option value={TextureType.albedo}>Albedo</Option>
                <Option value={TextureType.normal}>Normal</Option>
                <Option value={TextureType.displace}>Displace</Option>
                <Option value={TextureType.ao}>AO</Option>
                <Option value={TextureType.roughness}>Roughness</Option>
                <Option value={TextureType.metalness}>Metalness</Option>
                <Option value={TextureType.emissive}>Emissive</Option>
                <Option value={TextureType.alpha}>Alpha</Option>
              </Select>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.loadTexturesInScene++}>Load Scene Textures</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.clearAllTexture++}>Clear Textures</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.applyEnvMap++}>Apply Env Texture</Button>
            </div>
            <div className='toolbox-folder'>
              <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.convertToPBRMaterial++}>Convert To PBR</Button>
            </div>
          </div>
        </div>
      }

      <div className='toolbox-outfolder'>
        <div className='toolbox-outfolder-title'>Texture Preview</div>
        <canvas ref={canvasRef} width='170px' height='100px' style={{ backgroundColor: '#afafaf', width: '100%' }} />
      </div>

      {
        mode === 'edit' &&
        <div className='toolbox-outfolder'>
          <div className='toolbox-outfolder-title'>Edit Options</div>
          <div className='toolbox-folder'>
            <Select
              size='small'
              defaultValue={sceneSettings.edit.type} style={{ width: '100%' }} onChange={handleEditModeChange}>
              <Option value="sculpt">Sculpt</Option>
              <Option value="addvertex">Add Vertex</Option>
              <Option value="addface">Add Face</Option>
              <Option value="deletevertex">Simplify Face</Option>
              <Option value="deleteface">Delete Face</Option>
            </Select>
          </div>

          <div className='toolbox-folder'>
            <Button size='small' style={{ width: '100%' }} onClick={e => sceneSettings.action.extractFaces++}>Extract Faces</Button>
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
            defaultChecked={sceneSettings.global.showBVHHelper}
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
          <span>Center X:</span>
          <input
            type='number'
            onChange={e => sceneSettings.scene.baseMapCenterLng = parseFloat(e.target.value)}
            value={sceneSettings.scene.baseMapCenterLng}
            style={{
              width: 100,
              height: 25,
              border: 'none'
            }} />
        </div>
        <div className='toolbox-folder'>
          <span>Center Y:</span>
          <input
            type='number'
            onChange={e => sceneSettings.scene.baseMapCenterLat = parseFloat(e.target.value)}
            value={sceneSettings.scene.baseMapCenterLat}
            style={{
              width: 100,
              height: 25,
              border: 'none'
            }} />
        </div>
        <div className='toolbox-folder'>
          <span>Live Select</span><Switch defaultChecked={sceneSettings.scene.liveSelect} size='small' onChange={checked => sceneSettings.scene.liveSelect = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>Show BaseMap</span><Switch defaultChecked={sceneSettings.scene.showBaseMap} size='small' onChange={checked => sceneSettings.scene.showBaseMap = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>Show Skybox</span><Switch defaultChecked={sceneSettings.scene.showSkybox} size='small' onChange={checked => sceneSettings.scene.showSkybox = checked} />
        </div>
        {
          sceneSettings.scene.showBaseMap ?
            <div className='toolbox-folder'>
              <div>Map Brightness</div>
              <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.baseMapBrightness} step={0.05} min={0} max={1} onChange={value => sceneSettings.scene.baseMapBrightness = value} />
            </div>
            : null
        }
        <div className='toolbox-folder'>
          <span>Logarithmic ZBuffer</span>
          <Popconfirm placement="topLeft" title={'please note that this will cause page reload'} onConfirm={() => onBufferTypeChange()} okText="Yes" cancelText="No">
            <Switch checked={sceneSettings.scene.logarithmicDepthBuffer} size='small' />
          </Popconfirm>
        </div>
        <div className='toolbox-folder'>
          <span>Second Camera</span>
          <Popconfirm placement="topLeft" title={'please note that this will cause page reload'} onConfirm={() => onSecondCameraToggle()} okText="Yes" cancelText="No">
            <Switch checked={sceneSettings.scene.secondCamera} size='small' />
          </Popconfirm>
        </div>
        <div className='toolbox-folder'>
          <span>Enable Shadow</span><Switch defaultChecked={sceneSettings.scene.castShadow} size='small' onChange={checked => sceneSettings.scene.castShadow = checked} />
        </div>
        <div className='toolbox-folder'>
          <span>Direction Light</span><Switch defaultChecked={sceneSettings.scene.directionLight} size='small' onChange={checked => sceneSettings.scene.directionLight = checked} />
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
          <Slider style={{ flexGrow: 1 }} defaultValue={sceneSettings.scene.lightDistance} min={10} max={5000} onChange={value => sceneSettings.scene.lightDistance = value} />
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

    </div>
    {
      infoTable.data.length ?
        <div className='toolbox-infotable'>
          <Table
            scroll={{ y: 600 }}
            columns={infoTable.columns}
            dataSource={infoTable.data}
            pagination={false}
            size="small" />
        </div>
        : null
    }
  </div >
}

