import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export const SpeakerLinkedInGraph = ({ studentId, speakerId }) => {
  const d3Container = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch the graph data from backend
    const fetchGraphData = async () => {
      try {
        const res = await fetch(`/api/linkedin/graph?studentId=${studentId}&speakerId=${speakerId}`);
        const data = await res.json();
        if (res.ok) {
          setGraphData(data);
        } else {
          setError(data.error || 'Failed to load graph data');
        }
      } catch (err) {
        setError('Network error loading LinkedIn data');
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, [studentId, speakerId]);

  useEffect(() => {
    if (graphData && d3Container.current) {
      // Clear previous graph
      d3.select(d3Container.current).selectAll('*').remove();

      const width = 600;
      const height = 300;

      const svg = d3.select(d3Container.current)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`);

      const simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2));

      // Draw links
      const link = svg.append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(graphData.links)
        .join('line')
        .attr('stroke-width', d => Math.sqrt(d.value || 2));

      // Draw nodes
      const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(graphData.nodes)
        .join('circle')
        .attr('r', 25)
        .attr('fill', d => d.type === 'student' ? '#0077b5' : d.type === 'speaker' ? '#d9534f' : '#f0ad4e')
        .call(drag(simulation));

      node.append('title')
        .text(d => d.name);

      // Add labels
      const labels = svg.append('g')
        .selectAll('text')
        .data(graphData.nodes)
        .join('text')
        .attr('dy', 4)
        .attr('dx', -15)
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(d => d.name);

      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
          
        labels
          .attr('x', d => d.x + 30)
          .attr('y', d => d.y);
      });
      
      function drag(simulation) {
        function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        }
        
        function dragended(event) {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        }
        
        return d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended);
      }
    }
  }, [graphData]);

  if (loading) return <div style={{ padding: '20px' }}>Loading LinkedIn Social Graph...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div className="linkedin-graph-container" style={{ padding: '24px', border: '1px solid #e0e0e0', borderRadius: '12px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png" alt="LinkedIn Logo" style={{ width: '28px', marginRight: '12px' }} />
        <h3 style={{ margin: 0, color: '#333' }}>Networking Proximity Map</h3>
      </div>
      
      <p style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#555' }}>
        You are a <strong style={{ color: '#0077b5' }}>{graphData.degreeDegree}-Degree Connection</strong> with the Speaker!
      </p>
      
      <div ref={d3Container} style={{ width: '100%', height: '300px', background: '#f4f6f8', borderRadius: '8px', overflow: 'hidden', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }} />
      
      <p style={{ marginTop: '15px', fontSize: '0.85rem', color: '#777', fontStyle: 'italic' }}>
        * Visual realization of your networking proximity. RSVP now to leverage this connection in person!
      </p>
    </div>
  );
};
