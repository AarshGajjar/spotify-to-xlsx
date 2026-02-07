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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-2">Rated Today</h3>
            <p className="text-4xl font-bold text-white">{stats.today}</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-2">Total Rated</h3>
            <p className="text-4xl font-bold text-green-500">{stats.total}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
        <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-6">Rating Distribution</h3>
        <div className="h-64">
            <Bar data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
};

export default Stats;
