import React, { useEffect, useRef, useState } from 'react';
import * as d3Base from 'd3';
import * as d3Dag from 'd3-dag';
import { GraphNode, sceneManager } from '../api/scene';
import { observe, sceneSettings } from '../editor/settings';
import { getAllVersions, Versions } from '../api/vertionControl';

const d3 = Object.assign({}, d3Base, d3Dag);

interface IProps {
}

export default function Toolbar({ }: IProps) {
  const ref = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {

    async function updateVersion() {

      if (sceneSettings.action.selectScene === 'None') {
        setVisible(false);
        return;
      }

      setVisible(true);
      const versions = await getAllVersions(sceneSettings.action.selectScene);

      if (ref.current) {
        ref.current.innerHTML = '';
        const data = versionsToDagData(versions);
        if (data.length) {
          drawDag(ref.current, data);
        }
      }

    }

    let onWheel = (e: WheelEvent) => {

      containerRef.current && (containerRef.current.scrollLeft += e.deltaY);

    };

    if (containerRef.current) {

      const container = containerRef.current;
      container.addEventListener('wheel', onWheel);

    }

    updateVersion();

    observe(() => sceneSettings.action.selectScene, async () => {
      await updateVersion();
    });

    observe(() => sceneSettings.action.updateVersions, async () => {
      await updateVersion();
    });

    return () => {
      (ref.current) && (ref.current.innerHTML = '');
      (containerRef.current) && containerRef.current.removeEventListener('wheel', onWheel);
    }
  }, []);

  return <div ref={containerRef} style={{ transition: 'height 0.2s', height: visible ? 150 : 0, width: '100%', overflowX: 'auto' }}>
    <svg style={{ height: 140 }} ref={ref}></svg>
    <div style={{ position: 'absolute', right: 2, writingMode: 'vertical-lr', top: 0, bottom: 0, textAlign: 'center' }}>Versions</div>
  </div>
}

interface DAGNode {
  originId: string;
  id: string;
  text: string;
  parentIds: string[];
}

function versionsToDagData(versions: Versions): DAGNode[] {

  const nodeName = versions.nodes.map(n => n.tagName);
  const nodeTable: Record<string, DAGNode> = {};

  const dagNodes: DAGNode[] = [{
    id: '',
    originId: '',
    text: 'root',
    parentIds: [],
  }];

  for (let link of versions.links) {

    if (!nodeTable[nodeName[link.to]]) {

      nodeTable[nodeName[link.to]] = {
        id: nodeName[link.to],
        originId: nodeName[link.to],
        text: nodeName[link.to],
        parentIds: [nodeName[link.from]],
      };

    } else {

      nodeTable[nodeName[link.to]].parentIds.push(nodeName[link.from]);

    }

  }

  for (let node of Object.values(nodeTable)) {

    dagNodes.push(node);

  }

  return dagNodes;

}

async function drawDag(svgNode: SVGSVGElement, data: DAGNode[]) {
  // const resp = await fetch(
  //   "https://raw.githubusercontent.com/erikbrinkman/d3-dag/main/examples/grafo.json"
  // );
  // const data = await resp.json();
  console.log(data);
  const nodeRadius = 30;
  const edgeRadius = 20;

  const baseLayout = d3
    .zherebko()
    .nodeSize([
      nodeRadius * 2,
      (nodeRadius + edgeRadius) * 2,
      edgeRadius * 2
    ]);
  const dag = d3.dagStratify()(data);
  const layout = (dag: any) => {
    const { width, height } = baseLayout(dag);
    for (const node of dag) {
      [node.x, node.y] = [node.y, node.x];
    }
    for (const { points } of dag.ilinks()) {
      for (const point of points) {
        [point.x, point.y] = [point.y, point.x];
      }
    }
    return { width: height, height: width };
  };
  // Get laidout dag
  const { width, height } = layout(dag);
  for (const { points } of dag.ilinks() as any) {
    // if (points.length > 2) console.log(points.slice(1, -1));
  }

  // This code only handles rendering

  const svgSelection = d3.select(svgNode);
  const defs = svgSelection.append("defs"); // For gradients

  const steps = dag.size();
  const interp = d3.interpolateRainbow;
  const colorMap: any = {};
  for (const [i, node] of [...dag as any].entries() as any) {
    colorMap[node.data.id] = interp(i / steps);
  }

  // How to draw edges
  const curveStyle = d3.curveNatural;
  const line = d3
    .line()
    .curve(curveStyle)
    .x((d: any) => d.x)
    .y((d: any) => d.y);

  // Plot edges
  svgSelection.attr("viewBox", [0, 0, 2500, height > 100 ? height : 100].join(" "));
  svgSelection
    .append("g")
    .selectAll("path")
    .data(dag.links())
    .enter()
    .append("path")
    .attr("d", ({ points }) => line(points as any))
    .attr("fill", "none")
    .attr("stroke-width", 1)
    .attr("stroke", ({ source, target }: any) => {
      // encode URI component to handle special characters
      // const gradId = encodeURIComponent(`${source.data.id}-${target.data.id}`);
      // const grad = defs
      //   .append("linearGradient")
      //   .attr("id", gradId)
      //   .attr("gradientUnits", "userSpaceOnUse")
      //   .attr("x1", source.x)
      //   .attr("x2", target.x)
      //   .attr("y1", source.y)
      //   .attr("y2", target.y);
      // grad
      //   .append("stop")
      //   .attr("offset", "0%")
      //   .attr("stop-color", colorMap[source.data.id]);
      // grad
      //   .append("stop")
      //   .attr("offset", "100%")
      //   .attr("stop-color", colorMap[target.data.id]);
      // return `url(#${gradId})`;
      return '#aaaaaa'
    });

  // Select nodes
  const nodes = svgSelection
    .append("g")
    .selectAll("g")
    .data(dag.descendants())
    .enter()
    .append("g")
    .on('click', (e, d) => {
      const id = d.data.originId;
      // sceneManager.forwardToNode(id);
      sceneSettings.scene.currentTileVersion = id;
      rect.attr("fill", (node) => {
        return node.data.id === id ?
          '#eaa'
          : '#999';
      });
    })
    .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);

  // Plot node circles
  let rect = nodes
    .append('rect')
    .attr('x', -40)
    .attr('y', -10)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('width', 80)
    .attr('height', 20)
    .attr('stroke', "yellow")
    .attr('filter', 'drop-shadow( 1px 1px 1px rgba(0, 0, 0, .3))')
    .attr('stroke-width', 1)
    .attr('style', 'transition: all 0.1s; cursor: pointer;')
    .attr("fill", (node) => {
      return node.data.id === sceneSettings.scene.currentTileVersion ?
        '#eaa'
        : '#999';
    });
  // .append("circle")
  // .attr("r", nodeRadius)

  // Add text to nodes
  nodes
    .append("text")
    .text((d) => d.data.text)
    .attr("font-weight", "normal")
    .attr("font-size", "12px")
    .attr("font-family", "sans-serif")
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("fill", "white")
    .attr('style', 'cursor: pointer;');
}