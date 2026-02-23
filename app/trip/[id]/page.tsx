'use client';
import { useParams } from 'next/navigation';
import { auth } from '@/lib/firebase';

export default function TripDashboard() {
  const { id } = useParams();

  const shareTrip = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join my Fair Square Trip!',
        text: `Use Trip ID: ${id} to split expenses with me.`,
        url: window.location.href,
      });
    } else {
      alert(`Text this ID to friends: ${id}`);
    }
  };

  return (
    <main className="p-6 max-w-md mx-auto bg-white min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black">TRIP: {id}</h1>
        <button 
          onClick={shareTrip}
          className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm"
        >
          INVITE +
        </button>
      </div>

      <div className="bg-slate-100 rounded-2xl p-8 text-center border-2 border-dashed border-slate-300">
        <p className="text-slate-500 font-medium">No expenses yet.</p>
        <button className="mt-4 bg-blue-600 text-white w-full py-4 rounded-xl font-bold shadow-lg">
          ADD FIRST EXPENSE
        </button>
      </div>
    </main>
  );
}