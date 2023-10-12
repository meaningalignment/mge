import { useEffect, useRef, useState } from "react";
import ValuesCard from "./values-card";
import * as d3 from "d3";
import { MoralGraphSummary } from "~/values-tools/moral-graph-summary";

function logisticFunction(n: number, midpoint: number = 6, scale: number = 2): number {
  return 1 / (1 + Math.exp(-(n - midpoint) / scale));
}

interface Node {
  id: number
  title: string
  wisdom?: number
}

interface Link {
  source: number
  target: number
  avg: number
  thickness: number
}

type MoralGraphEdge = MoralGraphSummary["edges"][0]

function InfoBox({ node, x, y }: { node: Node | null; x: number; y: number }) {
  if (!node) return null

  const boxWidth = 200; // Assume a box width
  const offset = 20; // Offset from the cursor position
  const viewportWidth = window.innerWidth; // Width of the viewport

  // If the box would overflow the right edge of the viewport, 
  // position it to the left of the cursor, otherwise to the right.
  const leftPosition = x + boxWidth + offset > viewportWidth
    ? x - boxWidth - offset
    : x + offset;

  const style = {
    position: "absolute",
    left: leftPosition,
    top: y + offset,
  }

  return (
    <div className="info-box" style={style as any}>
      <ValuesCard card={node as any} inlineDetails />
    </div>
  )
}


export function MoralGraph({ nodes, edges }: { nodes: Node[]; edges: MoralGraphEdge[] }) {
  const nodes2 = [...nodes]
  const links = edges.map((edge) => ({
    source: edge.sourceValueId,
    target: edge.wiserValueId,
    avg: edge.summary.wiserLikelihood,
    thickness: (1 - edge.summary.entropy / 1.8) * logisticFunction(edge.counts.impressions),
  })) satisfies Link[]
  links.forEach((link) => {
    const target = nodes2.find((node) => node.id === link.target)
    if (target) {
      if (!target.wisdom) target.wisdom = link.avg
      else target.wisdom += link.avg
    }
  })
  console.log(nodes2)
  return <GraphWithInfoBox nodes2={nodes2} links={links} />
}

function GraphWithInfoBox({ nodes2, links }: { nodes2: Node[]; links: Link[] }) {
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })

  return (
    <>
      <Graph nodes2={nodes2} links={links} setHoveredNode={setHoveredNode} setPosition={setPosition} />
      <InfoBox node={hoveredNode} x={position.x} y={position.y} />
    </>
  )
}

function Graph({ nodes2, links, setHoveredNode, setPosition }: { nodes2: Node[]; links: Link[], setHoveredNode: (node: Node | null) => void, setPosition: (position: { x: number; y: number }) => void }) {
  let hoverTimeout: NodeJS.Timeout | null = null
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = d3
      .select(ref.current)
      .attr("width", "100%") // Full-screen width
      .attr("height", "100vh") // Full-screen height
      .attr("zoom", "1")

    svg.selectAll("g > *").remove()
    const g = svg.append("g")

    // Define arrow markers
    svg
      .append("defs")
      .selectAll("marker")
      .data(["end"])
      .enter()
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20) // Adjust position for bigger arrowhead
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 4) // Increase size
      .attr("markerHeight", 4) // Increase size
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")

    // Add zoom behavior
    const zoom = d3.zoom().on("zoom", (event) => {
      g.attr("transform", event.transform)
    })
    // @ts-ignore
    svg.call(zoom)

    // Create force simulation
    const simulation = d3
      // @ts-ignore
      .forceSimulation<Node, Link>(nodes2)
      .force(
        "link",
        // @ts-ignore
        d3
          // @ts-ignore
          .forceLink<Link, Node>(links)
          // @ts-ignore
          .id((d: Node) => d.id)
          .distance(120)
      )
      // @ts-ignore
      .force(
        "charge",
        // @ts-ignore
        d3
          .forceManyBody().strength(-50)

      ) // Weaker repulsion within groups
      .force(
        "center",
        // @ts-ignore
        d3
          .forceCenter(window.innerWidth / 2, window.innerHeight / 2)
          .strength(0.05)
      ) // Weaker central pull

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => d3.interpolateGreys(d.thickness * 5))
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)") // Add arrowheads

    // Draw edge labels
    const edgeLabels = g
      .append("g")
      .selectAll("text")
      .data(links)
      .enter()
      .append("text")
      .attr("font-size", "8px")
      .attr("fill", "#cccccc")
      .attr("text-anchor", "middle")
      .attr("dy", -5)

    // Draw nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes2)
      .join("circle")
      .attr("r", 10)
      .attr("fill", (d: Node) => (d.wisdom ?
        d3.interpolateBlues(d.wisdom / 5) :
        "lightgray"
      ))
      .on("mouseover", (event: any, d: Node) => {
        if (hoverTimeout) clearTimeout(hoverTimeout)
        setHoveredNode(d)
        setPosition({ x: event.clientX, y: event.clientY })
      })
      .on("mouseout", () => {
        hoverTimeout = setTimeout(() => {
          setHoveredNode(null)
        }, 200) // 200 milliseconds delay
      })
      .call(
        // @ts-ignore
        d3
          .drag() // Make nodes draggable
          .on("start", dragStart)
          .on("drag", dragging)
          .on("end", dragEnd)
      )

    // Draw labels
    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes2)
      .join("text")
      .text((d: Node) => d.title)
      .attr("font-size", "10px")

    // Update positions
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      edgeLabels
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2)
        .text((d: any) => d.avg.toFixed(3))

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y)

      label.attr("x", (d: any) => d.x + 15).attr("y", (d: any) => d.y + 4)
    })

    // Drag functions
    function dragStart(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragging(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragEnd(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }
  }, [nodes2, links])
  return <svg ref={ref} style={{ userSelect: "none" }}>
    <g></g>
  </svg>
}