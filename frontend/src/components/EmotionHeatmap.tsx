import React, { useState, useEffect, useRef } from 'react';
import { Filter, Download, RefreshCw, Info } from 'lucide-react';

interface EmotionData {
  group: string;
  emotions: {
    anger: number;
    sarcasm: number;
    frustration: number;
    betrayal: number;
    confusion: number;
    joy: number;
  };
  totalFeedback: number;
  averageSentiment: number;
  lastUpdated: string;
}

interface HeatmapFilters {
  groupBy: 'platform' | 'region' | 'topic';
  platform?: string;
  startDate?: string;
  endDate?: string;
}

interface EmotionHeatmapProps {
  className?: string;
}

const EmotionHeatmap: React.FC<EmotionHeatmapProps> = ({ className = '' }) => {
  const [data, setData] = useState<EmotionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HeatmapFilters>({
    groupBy: 'platform'
  });
  const [selectedCell, setSelectedCell] = useState<{
    group: string;
    emotion: string;
    value: number;
    data: EmotionData;
  } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    group: string;
    emotion: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mock data for demonstration
  const mockData: EmotionData[] = [
    {
      group: 'Twitter',
      emotions: { anger: 45, sarcasm: 32, frustration: 67, betrayal: 23, confusion: 18, joy: 12 },
      totalFeedback: 1250,
      averageSentiment: -0.3,
      lastUpdated: new Date().toISOString()
    },
    {
      group: 'Reddit',
      emotions: { anger: 38, sarcasm: 56, frustration: 42, betrayal: 19, confusion: 34, joy: 28 },
      totalFeedback: 890,
      averageSentiment: -0.1,
      lastUpdated: new Date().toISOString()
    },
    {
      group: 'TrustPilot',
      emotions: { anger: 72, sarcasm: 15, frustration: 89, betrayal: 45, confusion: 23, joy: 8 },
      totalFeedback: 567,
      averageSentiment: -0.6,
      lastUpdated: new Date().toISOString()
    },
    {
      group: 'App Store',
      emotions: { anger: 29, sarcasm: 21, frustration: 51, betrayal: 16, confusion: 67, joy: 34 },
      totalFeedback: 743,
      averageSentiment: -0.2,
      lastUpdated: new Date().toISOString()
    }
  ];

  useEffect(() => {
    fetchHeatmapData();
  }, [filters]);

  useEffect(() => {
    if (data.length > 0) {
      drawHeatmap();
    }
  }, [data, hoveredCell]);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, this would call your API
      // const params = new URLSearchParams(filters);
      // const response = await fetch(`/api/analysis/heatmap?${params}`);
      // const result = await response.json();
      
      // For now, use mock data
      setData(mockData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch heatmap data');
      console.error('Error fetching heatmap data:', err);
    } finally {
      setLoading(false);
    }
  };

  const drawHeatmap = () => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const emotions = ['anger', 'sarcasm', 'frustration', 'betrayal', 'confusion', 'joy'];
    const cellWidth = canvas.width / emotions.length;
    const cellHeight = canvas.height / data.length;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find max value for normalization
    const maxValue = Math.max(
      ...data.flatMap(item => Object.values(item.emotions))
    );

    // Draw cells
    data.forEach((item, rowIndex) => {
      emotions.forEach((emotion, colIndex) => {
        const value = item.emotions[emotion as keyof typeof item.emotions];
        const intensity = value / maxValue;
        
        // Color based on emotion type and intensity
        const emotionColors = {
          anger: [220, 53, 69],      // Red
          sarcasm: [255, 193, 7],    // Yellow
          frustration: [255, 87, 34], // Orange
          betrayal: [156, 39, 176],   // Purple
          confusion: [96, 125, 139],  // Blue-gray
          joy: [76, 175, 80]         // Green
        };

        const [r, g, b] = emotionColors[emotion as keyof typeof emotionColors];
        const alpha = 0.2 + (intensity * 0.8); // Min 0.2, max 1.0

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        
        const x = colIndex * cellWidth;
        const y = rowIndex * cellHeight;
        
        ctx.fillRect(x, y, cellWidth, cellHeight);
        
        // Add border
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);
        
        // Highlight hovered cell
        if (hoveredCell && hoveredCell.group === item.group && hoveredCell.emotion === emotion) {
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, cellWidth, cellHeight);
        }
        
        // Add text if cell is large enough
        if (cellWidth > 60 && cellHeight > 40) {
          ctx.fillStyle = intensity > 0.5 ? '#ffffff' : '#000000';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            value.toString(),
            x + cellWidth / 2,
            y + cellHeight / 2
          );
        }
      });
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const emotions = ['anger', 'sarcasm', 'frustration', 'betrayal', 'confusion', 'joy'];
    const cellWidth = canvas.width / emotions.length;
    const cellHeight = canvas.height / data.length;

    const colIndex = Math.floor(x / cellWidth);
    const rowIndex = Math.floor(y / cellHeight);

    if (colIndex >= 0 && colIndex < emotions.length && rowIndex >= 0 && rowIndex < data.length) {
      const emotion = emotions[colIndex];
      const groupData = data[rowIndex];
      const value = groupData.emotions[emotion as keyof typeof groupData.emotions];

      setSelectedCell({
        group: groupData.group,
        emotion,
        value,
        data: groupData
      });
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const emotions = ['anger', 'sarcasm', 'frustration', 'betrayal', 'confusion', 'joy'];
    const cellWidth = canvas.width / emotions.length;
    const cellHeight = canvas.height / data.length;

    const colIndex = Math.floor(x / cellWidth);
    const rowIndex = Math.floor(y / cellHeight);

    if (colIndex >= 0 && colIndex < emotions.length && rowIndex >= 0 && rowIndex < data.length) {
      const emotion = emotions[colIndex];
      const group = data[rowIndex].group;
      
      setHoveredCell({ group, emotion });
    } else {
      setHoveredCell(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCell(null);
  };

  const exportHeatmap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `emotion-heatmap-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const getEmotionColor = (emotion: string) => {
    const colors = {
      anger: 'text-red-400',
      sarcasm: 'text-yellow-400',
      frustration: 'text-orange-400',
      betrayal: 'text-purple-400',
      confusion: 'text-blue-400',
      joy: 'text-green-400'
    };
    return colors[emotion as keyof typeof colors] || 'text-gray-400';
  };

  return (
    <div className={`bg-secondary rounded-lg border border-primary ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-primary">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-primary">Emotion Heatmap</h2>
          <div className="flex space-x-2">
            <button
              onClick={exportHeatmap}
              className="btn-secondary flex items-center"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
            <button
              onClick={fetchHeatmapData}
              disabled={loading}
              className="btn-secondary flex items-center"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-secondary" />
            <select
              value={filters.groupBy}
              onChange={(e) => setFilters(prev => ({ ...prev, groupBy: e.target.value as any }))}
              className="input-field"
            >
              <option value="platform">Group by Platform</option>
              <option value="region">Group by Region</option>
              <option value="topic">Group by Topic</option>
            </select>
          </div>

          <select
            value={filters.platform || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value || undefined }))}
            className="input-field"
          >
            <option value="">All Platforms</option>
            <option value="twitter">Twitter</option>
            <option value="reddit">Reddit</option>
            <option value="trustpilot">TrustPilot</option>
            <option value="appstore">App Store</option>
          </select>

          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value || undefined }))}
            className="input-field"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value || undefined }))}
            className="input-field"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-4">
            <p className="text-red-400">⚠️ {error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-secondary mt-2">Loading heatmap data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12">
            <Info className="h-12 w-12 text-secondary mx-auto mb-4" />
            <p className="text-secondary">No data available for the selected filters</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Legend */}
            <div className="flex flex-wrap gap-4 justify-center">
              {['anger', 'sarcasm', 'frustration', 'betrayal', 'confusion', 'joy'].map(emotion => (
                <div key={emotion} className="flex items-center space-x-2">
                  <div className={`w-4 h-4 rounded ${
                    emotion === 'anger' ? 'bg-red-400' :
                    emotion === 'sarcasm' ? 'bg-yellow-400' :
                    emotion === 'frustration' ? 'bg-orange-400' :
                    emotion === 'betrayal' ? 'bg-purple-400' :
                    emotion === 'confusion' ? 'bg-blue-400' :
                    'bg-green-400'
                  }`}></div>
                  <span className="text-sm text-primary capitalize">{emotion}</span>
                </div>
              ))}
            </div>

            {/* Heatmap Container */}
            <div className="flex">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-around pr-4" style={{ height: '400px' }}>
                {data.map((item, index) => (
                  <div key={index} className="text-sm text-primary text-right">
                    {item.group}
                  </div>
                ))}
              </div>

              {/* Heatmap Canvas */}
              <div className="flex-1">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={400}
                  className="border border-primary rounded cursor-pointer"
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={handleCanvasMouseLeave}
                />
                
                {/* X-axis labels */}
                <div className="flex justify-around mt-2">
                  {['Anger', 'Sarcasm', 'Frustration', 'Betrayal', 'Confusion', 'Joy'].map(emotion => (
                    <div key={emotion} className="text-sm text-primary">
                      {emotion}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tooltip/Selected Cell Info */}
            {(hoveredCell || selectedCell) && (
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-3">
                  {hoveredCell ? 'Hover Details' : 'Selected Cell Details'}
                </h3>
                
                {(() => {
                  const cellInfo = selectedCell?.data || (hoveredCell && data.find(d => d.group === hoveredCell.group));
                  const emotion = selectedCell?.emotion || hoveredCell?.emotion;
                  
                  if (!cellInfo || !emotion) return null;
                  
                  const value = cellInfo.emotions[emotion as keyof typeof cellInfo.emotions];
                  
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-secondary">Platform/Group</label>
                        <p className="text-primary">{cellInfo.group}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">Emotion</label>
                        <p className={`capitalize ${getEmotionColor(emotion)}`}>{emotion}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">Count</label>
                        <p className="text-primary font-bold">{value}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">Total Feedback</label>
                        <p className="text-primary">{cellInfo.totalFeedback}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">Percentage</label>
                        <p className="text-primary">{((value / cellInfo.totalFeedback) * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">Avg Sentiment</label>
                        <p className={`${cellInfo.averageSentiment >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {cellInfo.averageSentiment.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card">
                <h4 className="text-sm font-medium text-secondary mb-2">Total Feedback</h4>
                <p className="text-2xl font-bold text-primary">
                  {data.reduce((sum, item) => sum + item.totalFeedback, 0).toLocaleString()}
                </p>
              </div>
              <div className="card">
                <h4 className="text-sm font-medium text-secondary mb-2">Most Common Emotion</h4>
                <p className="text-2xl font-bold text-primary">
                  {(() => {
                    const emotionTotals = data.reduce((acc, item) => {
                      Object.entries(item.emotions).forEach(([emotion, count]) => {
                        acc[emotion] = (acc[emotion] || 0) + count;
                      });
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const topEmotion = Object.entries(emotionTotals)
                      .sort(([,a], [,b]) => b - a)[0];
                    
                    return topEmotion ? topEmotion[0] : 'N/A';
                  })()}
                </p>
              </div>
              <div className="card">
                <h4 className="text-sm font-medium text-secondary mb-2">Average Sentiment</h4>
                <p className={`text-2xl font-bold ${
                  data.reduce((sum, item) => sum + item.averageSentiment, 0) / data.length >= 0 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {(data.reduce((sum, item) => sum + item.averageSentiment, 0) / data.length).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmotionHeatmap;