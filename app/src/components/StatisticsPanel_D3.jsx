import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const COLORS = {
  sidewalk: '#4A90E2',
  road: '#FF6B6B',
  crosswalk: '#4ECDC4'
};

// ============================================================================
// TEMPORAL TREND LINE CHART - DARK MODE AWARE
// ============================================================================
export function TemporalTrendChart({ yearlyStats, years, width = 600, height = 300, theme }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!yearlyStats || !years || !svgRef.current) return;

    const chartData = years.map(year => ({
      year,
      sidewalk: yearlyStats[year]?.sidewalk?.totalLength || 0,
      road: yearlyStats[year]?.road?.totalLength || 0,
      crosswalk: (yearlyStats[year]?.crosswalk?.featureCount || 0) / 10
    }));

    const hasData = chartData.some(d => d.sidewalk > 0 || d.road > 0 || d.crosswalk > 0);
    if (!hasData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 120, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear().domain(d3.extent(years)).range([0, innerWidth]);
    const yMax = d3.max(chartData, d => Math.max(d.sidewalk, d.road, d.crosswalk)) * 1.1;
    const yScale = d3.scaleLinear().domain([0, yMax || 1]).range([innerHeight, 0]);

    // Grid (theme-aware)
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
      .selectAll('line')
      .attr('stroke', theme.gridLine);

    // Axes (theme-aware text)
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format('d')))
      .style('font-size', '12px')
      .selectAll('text')
      .attr('fill', theme.axisText);

    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale))
      .style('font-size', '12px');
    
    yAxis.selectAll('text').attr('fill', theme.axisText);
    yAxis.selectAll('line').attr('stroke', theme.border);
    yAxis.selectAll('path').attr('stroke', theme.border);

    yAxis.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('fill', theme.textSecondary)
      .attr('font-size', '13px')
      .attr('text-anchor', 'middle')
      .text('Length (km)');

    // Line generators
    const lineGenerators = {
      sidewalk: d3.line().x(d => xScale(d.year)).y(d => yScale(d.sidewalk)).curve(d3.curveMonotoneX),
      road: d3.line().x(d => xScale(d.year)).y(d => yScale(d.road)).curve(d3.curveMonotoneX),
      crosswalk: d3.line().x(d => xScale(d.year)).y(d => yScale(d.crosswalk)).curve(d3.curveMonotoneX)
    };

    // Draw ANIMATED lines
    Object.entries(lineGenerators).forEach(([type, lineGen]) => {
      const path = g.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', COLORS[type])
        .attr('stroke-width', 3)
        .attr('d', lineGen);

      const totalLength = path.node().getTotalLength();
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    });

    // Interactive points
    Object.keys(COLORS).forEach((type, typeIndex) => {
      g.selectAll(`.dot-${type}`)
        .data(chartData)
        .enter()
        .append('circle')
        .attr('class', `dot-${type}`)
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d[type]))
        .attr('r', 0)
        .attr('fill', COLORS[type])
        .attr('stroke', theme.surface)
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .transition()
        .duration(400)
        .delay((d, i) => 1000 + typeIndex * 200 + i * 50)
        .ease(d3.easeBackOut)
        .attr('r', 5)
        .on('end', function() {
          d3.select(this)
            .on('mouseover', function(event, d) {
              d3.select(this).transition().duration(150).attr('r', 8);
              
              const tooltip = g.append('g').attr('class', 'tooltip')
                .attr('transform', `translate(${xScale(d.year)},${yScale(d[type]) - 20})`);
              
              const text = type === 'crosswalk' 
                ? `${d.year}: ${d[type].toFixed(1)} (×10 count)`
                : `${d.year}: ${d[type].toFixed(2)} km`;
              
              const bbox = tooltip.append('text')
                .attr('text-anchor', 'middle')
                .attr('fill', theme.tooltipText)
                .attr('font-size', '11px')
                .attr('y', -12)
                .text(text)
                .node().getBBox();
              
              tooltip.insert('rect', 'text')
                .attr('x', bbox.x - 5)
                .attr('y', bbox.y - 2)
                .attr('width', bbox.width + 10)
                .attr('height', bbox.height + 4)
                .attr('fill', theme.tooltipBg)
                .attr('rx', 4);
            })
            .on('mouseout', function() {
              d3.select(this).transition().duration(150).attr('r', 5);
              g.selectAll('.tooltip').remove();
            });
        });
    });

    // Legend
    const legend = g.append('g')
      .attr('transform', `translate(${innerWidth + 10}, 0)`)
      .attr('opacity', 0);

    Object.entries(COLORS).forEach(([type, color], i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 25})`);

      legendRow.append('line')
        .attr('x1', 0).attr('x2', 30)
        .attr('stroke', color).attr('stroke-width', 3);

      legendRow.append('circle')
        .attr('cx', 15).attr('cy', 0).attr('r', 5)
        .attr('fill', color)
        .attr('stroke', theme.surface).attr('stroke-width', 2);

      legendRow.append('text')
        .attr('x', 35).attr('y', 4)
        .attr('font-size', '12px')
        .attr('fill', theme.textSecondary)
        .text(type.charAt(0).toUpperCase() + type.slice(1));
    });

    legend.transition().duration(500).delay(1800).attr('opacity', 1);

  }, [yearlyStats, years, width, height, theme]);

  return (
    <div style={{ 
      background: theme.chartBackground, 
      padding: '20px', 
      borderRadius: '12px', 
      boxShadow: theme.shadowSm,
      transition: 'all 0.3s ease'
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600', color: theme.textPrimary }}>
        📈 Infrastructure Growth Over Time
      </h3>
      <svg ref={svgRef} width={width} height={height} />
      <div style={{ fontSize: '11px', color: theme.textTertiary, marginTop: '10px', fontStyle: 'italic' }}>
        * Crosswalk counts scaled (÷10) for visualization. Hover over points for exact values.
      </div>
    </div>
  );
}

// ============================================================================
// COMPARATIVE BAR CHART - DARK MODE AWARE
// ============================================================================
export function ComparativeBarChart({ comparativeStats, width = 600, height = 300, theme }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!comparativeStats || comparativeStats.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(comparativeStats.map(d => d.year))
      .range([0, innerWidth])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(comparativeStats, d => d.sidewalkToRoadRatio) * 1.1])
      .range([innerHeight, 0]);

    // Axes (theme-aware)
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .style('font-size', '12px');
    
    xAxis.selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('fill', theme.axisText);
    
    xAxis.selectAll('line').attr('stroke', theme.border);
    xAxis.selectAll('path').attr('stroke', theme.border);

    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .style('font-size', '12px');
    
    yAxis.selectAll('text').attr('fill', theme.axisText);
    yAxis.selectAll('line').attr('stroke', theme.border);
    yAxis.selectAll('path').attr('stroke', theme.border);

    yAxis.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('fill', theme.textSecondary)
      .attr('font-size', '13px')
      .attr('text-anchor', 'middle')
      .text('Ratio');

    // ANIMATED Bars
    g.selectAll('.bar')
      .data(comparativeStats)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.year))
      .attr('y', innerHeight)
      .attr('width', xScale.bandwidth())
      .attr('height', 0)
      .attr('fill', COLORS.sidewalk)
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .transition()
      .duration(800)
      .delay((d, i) => i * 80)
      .ease(d3.easeCubicOut)
      .attr('y', d => yScale(d.sidewalkToRoadRatio))
      .attr('height', d => innerHeight - yScale(d.sidewalkToRoadRatio))
      .on('end', function() {
        d3.select(this)
          .on('mouseover', function(event, d) {
            d3.select(this)
              .transition()
              .duration(150)
              .attr('fill', d3.rgb(COLORS.sidewalk).darker(0.5));
            
            g.append('text')
              .attr('class', 'value-label')
              .attr('x', xScale(d.year) + xScale.bandwidth() / 2)
              .attr('y', yScale(d.sidewalkToRoadRatio) - 10)
              .attr('text-anchor', 'middle')
              .attr('font-size', '12px')
              .attr('font-weight', '600')
              .attr('fill', theme.textPrimary)
              .text(d.sidewalkToRoadRatio.toFixed(2))
              .attr('opacity', 0)
              .transition()
              .duration(150)
              .attr('opacity', 1);
          })
          .on('mouseout', function() {
            d3.select(this)
              .transition()
              .duration(150)
              .attr('fill', COLORS.sidewalk);
            g.selectAll('.value-label').remove();
          });
      });

  }, [comparativeStats, width, height, theme]);

  return (
    <div style={{ 
      background: theme.chartBackground, 
      padding: '20px', 
      borderRadius: '12px', 
      boxShadow: theme.shadowSm,
      transition: 'all 0.3s ease'
    }}>
      <h3 style={{ 
        margin: '0 0 5px 0', 
        fontSize: '16px', 
        fontWeight: '600',
        color: theme.textPrimary
      }}>
        📊 Pedestrian-Friendliness Score
      </h3>
      <p style={{ 
        margin: '0 0 15px 0', 
        fontSize: '13px', 
        color: theme.textSecondary,
        fontStyle: 'italic'
      }}>
        Sidewalk to Road Ratio — Higher is more walkable
      </p>
      <svg ref={svgRef} width={width} height={height} />
      <div style={{ fontSize: '11px', color: theme.textTertiary, marginTop: '10px' }}>
        Hover over bars for exact ratios. Values &gt;1.0 indicate excellent pedestrian infrastructure.
      </div>
    </div>
  );
}

// ============================================================================
// RADIAL CHART - DARK MODE AWARE
// ============================================================================
export function InfrastructureRadial({ currentStats, size = 200, theme }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!currentStats || !svgRef.current) return;

    const metrics = [
      { label: 'Sidewalks', value: currentStats.sidewalk?.totalLength || 0, color: COLORS.sidewalk },
      { label: 'Roads', value: currentStats.road?.totalLength || 0, color: COLORS.road },
      { label: 'Crosswalks', value: (currentStats.crosswalk?.featureCount || 0) * 0.05, color: COLORS.crosswalk }
    ];

    const total = d3.sum(metrics, d => d.value);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = size / 2;
    const innerRadius = radius * 0.6;

    const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);

    if (total === 0) {
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', theme.textTertiary)
        .text('No data');
      return;
    }

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius - 10);
    const arcHover = d3.arc().innerRadius(innerRadius).outerRadius(radius - 5);

    const arcs = g.selectAll('.arc')
      .data(pie(metrics))
      .enter()
      .append('path')
      .attr('fill', d => d.data.color)
      .attr('stroke', theme.surface)
      .attr('stroke-width', 3)
      .style('cursor', 'pointer')
      .each(function(d) { this._current = { startAngle: 0, endAngle: 0 }; });

    arcs.transition()
      .duration(1000)
      .delay((d, i) => i * 150)
      .ease(d3.easeBackOut)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(1);
        return t => arc(interpolate(t));
      })
      .on('end', function() {
        d3.select(this)
          .on('mouseover', function() {
            d3.select(this).transition().duration(200).attr('d', arcHover);
          })
          .on('mouseout', function() {
            d3.select(this).transition().duration(200).attr('d', arc);
          });
      });

    const centerText = g.append('g').attr('opacity', 0);

    centerText.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .attr('font-size', '24px')
      .attr('font-weight', '700')
      .attr('fill', theme.textPrimary)
      .text(total.toFixed(1));

    centerText.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('font-size', '12px')
      .attr('fill', theme.textTertiary)
      .text('Total km');

    centerText.transition().duration(500).delay(800).attr('opacity', 1);

  }, [currentStats, size, theme]);

  return (
    <div style={{ 
      background: theme.chartBackground, 
      padding: '20px', 
      borderRadius: '12px', 
      boxShadow: theme.shadowSm, 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      transition: 'all 0.3s ease'
    }}>
      <svg ref={svgRef} width={size} height={size} style={{ display: 'block' }} />
    </div>
  );
}

// ============================================================================
// STATISTICS PANEL - DARK MODE AWARE
// ============================================================================
export default function StatisticsPanel({ 
  yearlyStats, 
  temporalStats, 
  comparativeStats,
  insights,
  currentYear,
  years,
  theme
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [tabKey, setTabKey] = useState(0);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setTabKey(prev => prev + 1);
  };

  if (!yearlyStats || Object.keys(yearlyStats).length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: theme.textTertiary }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
        <div style={{ fontSize: '16px', fontWeight: '500' }}>No statistics available</div>
        <div style={{ fontSize: '13px', marginTop: '8px' }}>Select a tile to view analytics</div>
      </div>
    );
  }

  const currentStats = yearlyStats[currentYear];

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: theme.chartSurface,
      transition: 'all 0.3s ease'
    }}>
      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        borderBottom: `2px solid ${theme.border}`,
        background: theme.surface,
        padding: '0 15px',
        gap: '5px',
        transition: 'all 0.3s ease'
      }}>
        {[
          { id: 'overview', label: '📊', title: 'Overview' },
          { id: 'trends', label: '📈', title: 'Trends' },
          { id: 'compare', label: '🔄', title: 'Compare' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeTab === tab.id ? theme.primary : 'transparent',
              color: activeTab === tab.id ? 'white' : theme.textSecondary,
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? '600' : '400',
              fontSize: '13px',
              borderRadius: '8px 8px 0 0',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={tab.title}
          >
            <span style={{ fontSize: '16px' }}>{tab.label}</span>
            <span>{tab.title}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
        {activeTab === 'overview' && (
          <OverviewTab 
            key={`overview-${tabKey}`} 
            currentStats={currentStats} 
            temporalStats={temporalStats} 
            currentYear={currentYear}
            theme={theme}
          />
        )}
        {activeTab === 'trends' && (
          <TrendsTab key={`trends-${tabKey}`} yearlyStats={yearlyStats} years={years} theme={theme} />
        )}
        {activeTab === 'compare' && (
          <CompareTab key={`compare-${tabKey}`} comparativeStats={comparativeStats} theme={theme} />
        )}
      </div>
    </div>
  );
}

// Tab Components
function OverviewTab({ currentStats, temporalStats, currentYear, theme }) {
  if (!currentStats) {
    return <div style={{ padding: '20px', textAlign: 'center', color: theme.textSecondary }}>
      No data for {currentYear}
    </div>;
  }

  const metrics = [
    {
      type: 'sidewalk',
      label: 'Sidewalks',
      value: currentStats.sidewalk?.totalLength.toFixed(2) || 0,
      unit: 'km',
      icon: '🚶',
      change: temporalStats?.sidewalk?.growthRate
    },
    {
      type: 'road',
      label: 'Roads',
      value: currentStats.road?.totalLength.toFixed(2) || 0,
      unit: 'km',
      icon: '🚗',
      change: temporalStats?.road?.growthRate
    },
    {
      type: 'crosswalk',
      label: 'Crosswalks',
      value: currentStats.crosswalk?.featureCount || 0,
      unit: 'count',
      icon: '🚸',
      change: temporalStats?.crosswalk?.growthRate
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px'
      }}>
        {metrics.map((metric, i) => (
          <div 
            key={metric.type} 
            style={{
              background: theme.cardBg,
              padding: '16px',
              borderRadius: '10px',
              boxShadow: theme.shadowSm,
              borderLeft: `4px solid ${COLORS[metric.type]}`,
              opacity: 0,
              animation: `fadeInUp 0.5s ease-out ${i * 0.1}s forwards`,
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>{metric.icon}</div>
            <div style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '6px', fontWeight: '500' }}>
              {metric.label}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: theme.textPrimary }}>
              {metric.value}
              <span style={{ fontSize: '12px', color: theme.textTertiary, marginLeft: '3px' }}>
                {metric.unit}
              </span>
            </div>
            {metric.change !== undefined && metric.change !== 0 && (
              <div style={{ 
                fontSize: '11px', 
                color: metric.change > 0 ? '#52BE80' : '#EC7063',
                marginTop: '6px',
                fontWeight: '600'
              }}>
                {metric.change > 0 ? '↑' : '↓'} {Math.abs(metric.change).toFixed(1)}% over 20 years
              </div>
            )}
          </div>
        ))}
      </div>

      <InfrastructureRadial currentStats={currentStats} size={200} theme={theme} />
      
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function TrendsTab({ yearlyStats, years, theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <TemporalTrendChart yearlyStats={yearlyStats} years={years} width={600} height={300} theme={theme} />
    </div>
  );
}

function CompareTab({ comparativeStats, theme }) {
  if (!comparativeStats || comparativeStats.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: theme.textSecondary }}>
      No comparative data available
    </div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <ComparativeBarChart comparativeStats={comparativeStats} width={600} height={300} theme={theme} />
    </div>
  );
}