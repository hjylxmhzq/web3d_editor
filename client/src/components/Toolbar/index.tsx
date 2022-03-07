import React, { useEffect, useRef, useState } from 'react';
import * as d3Base from 'd3';
import * as d3Dag from 'd3-dag';
import { GraphNode, sceneManager } from '../api/scene';

const d3 = Object.assign({}, d3Base, d3Dag);

interface IProps {
}

export default function Toolbar({ }: IProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [graph, setGraph] = useState(null);

  useEffect(() => {
    sceneManager.addListener('graphChange', (graph) => {
      setGraph(graph);
    })
  }, []);

  useEffect(() => {
    if (ref.current && graph) {
      ref.current.innerHTML = '';
      const data = dfsSearch(graph);
      drawDag(ref.current, data);
      return () => {
        (ref.current) && (ref.current.innerHTML = '');
      }
    }
  }, [graph]);

  return <div style={{ height: '100vh', width: '150px', overflow: 'hidden', marginLeft: 'auto' }}>
    <svg ref={ref}></svg>
  </div>
}

interface DAGNode {
  originId: string;
  id: string;
  text: string;
  parentIds: string[];
}

function dfsSearch(root: GraphNode) {

  const branchCount: Record<string, number> = {};
  function rename(n: GraphNode) {
    if (!branchCount[n.branch]) {
      branchCount[n.branch] = 1;
    } else {
      branchCount[n.branch] += 1;
    }
    n.name = n.branch + `[${branchCount[n.branch]}]`;
    for (let child of n.next) {
      rename(child);
    }
  }
  rename(root);

  const nodes = new Map<string, DAGNode>();
  function helper(n: GraphNode, parent: GraphNode | null) {
    if (parent) {
      if (nodes.has(n.name)) {
        nodes.get(n.name)?.parentIds.push(parent.name);
      } else {
        nodes.set(n.name, {
          originId: n.id,
          id: n.name,
          parentIds: [parent.name],
          text: n.type
        });
      }
    } else {
      nodes.set(n.name, {
        originId: n.id,
        id: n.name,
        parentIds: [],
        text: n.type,
      });
    }
    for (let child of n.next) {
      helper(child, n);
    }
  }
  helper(root, null);
  const result = Array.from(nodes).map(v => v[1]);
  return result;
}


async function drawDag(svgNode: SVGSVGElement, data: DAGNode[]) {
  // const resp = await fetch(
  //   "https://raw.githubusercontent.com/erikbrinkman/d3-dag/main/examples/grafo.json"
  // );
  // const data = await resp.json();
  console.log(data);
  const nodeRadius = 20;
  const edgeRadius = 10;

  const baseLayout = d3
    .zherebko()
    .nodeSize([
      nodeRadius * 2,
      (nodeRadius + edgeRadius) * 2,
      edgeRadius * 2
    ])
  const dag = d3.dagStratify()(data);
  const layout = (dag: any) => {
    const { width, height } = baseLayout(dag);
    // for (const node of dag) {
    //   [node.x, node.y] = [node.y, node.x];
    // }
    // for (const { points } of dag.ilinks()) {
    //   for (const point of points) {
    //     [point.x, point.y] = [point.y, point.x];
    //   }
    // }
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
  svgSelection.attr("viewBox", [0, 0, 150, 600].join(" "));
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
      sceneManager.forwardToNode(id);
    })
    .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);

  // Plot node circles
  nodes
  .append('rect')
  .attr('x', -30)
  .attr('y', -10)
  .attr('rx', 5)
  .attr('ry', 5)
  .attr('width', 60)
  .attr('height', 20)
  .attr("fill", (n) => colorMap[n.data.id]);
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
    .attr("fill", "white");
}