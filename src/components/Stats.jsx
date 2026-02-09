import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Stats = ({ stats }) => {
  const chartData = {
    labels: ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'],
    datasets: [
      {
        label: 'Ratings Count',
        data: [
            stats.distribution[1] || 0,
            stats.distribution[1.5] || 0,
            stats.distribution[2] || 0,
            stats.distribution[2.5] || 0,
            stats.distribution[3] || 0,
            stats.distribution[3.5] || 0,
            stats.distribution[4] || 0,
            stats.distribution[4.5] || 0,
            stats.distribution[5] || 0,
        ],
        backgroundColor: 'rgba(29, 185, 84, 0.6)',
        borderColor: 'rgba(29, 185, 84, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#aaa',
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#aaa',
        }
      }
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0 h-full overflow-y-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-zinc-400 text-xs md:text-sm font-medium uppercase tracking-wider mb-2">Rated Today</h3>
            <p className="text-2xl md:text-4xl font-bold text-white">{stats.today}</p>
        </div>
        <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-zinc-400 text-xs md:text-sm font-medium uppercase tracking-wider mb-2">Total Rated</h3>
            <p className="text-2xl md:text-4xl font-bold text-green-500">{stats.total}</p>
        </div>
        <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800 col-span-2 md:col-span-1">
            <h3 className="text-zinc-400 text-xs md:text-sm font-medium uppercase tracking-wider mb-2">Avg Rating</h3>
            <p className="text-2xl md:text-4xl font-bold text-blue-400">{stats.averageRating || '0.00'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chart */}
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-zinc-400 text-xs md:text-sm font-medium uppercase tracking-wider mb-4 md:mb-6">Rating Distribution</h3>
            <div className="h-48 md:h-64">
                <Bar data={chartData} options={options} />
            </div>
          </div>

          {/* Top Artists */}
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800 flex flex-col">
             <h3 className="text-zinc-400 text-xs md:text-sm font-medium uppercase tracking-wider mb-4 md:mb-6">Top Artists</h3>
             <div className="flex-1 flex flex-col gap-3">
                {stats.topArtists && stats.topArtists.length > 0 ? (
                    stats.topArtists.map((artist, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-zinc-500 font-mono text-sm w-4">{index + 1}</span>
                                <span className="font-medium truncate max-w-[150px] md:max-w-[200px]" title={artist.name}>{artist.name}</span>
                            </div>
                            <span className="text-zinc-400 text-sm font-mono">{artist.count}</span>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                        No data yet
                    </div>
                )}
             </div>
          </div>
      </div>
    </div>
  );
};

export default Stats;