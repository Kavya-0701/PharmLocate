import React from 'react';
import { PharmacyResult } from '../types';
import { MapPinIcon, ExternalLinkIcon, NavigationIcon, BoxIcon, ClockIcon, LoaderIcon } from './Icons';

interface PharmacyCardProps {
  pharmacy: PharmacyResult;
  onCheckStock: (pharmacy: PharmacyResult) => void;
  onCheckHours: (pharmacy: PharmacyResult) => void;
  isLoadingHours: boolean;
}

const PharmacyCard: React.FC<PharmacyCardProps> = ({ pharmacy, onCheckStock, onCheckHours, isLoadingHours }) => {
  return (
    <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-lg hover:border-teal-200 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
      
      {/* Decorative gradient blob */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />

      <div className="relative z-10 flex-1">
        <div className="flex justify-between items-start mb-2">
          <div className="bg-teal-50 p-2 rounded-lg text-teal-600 mb-3">
             <MapPinIcon className="w-5 h-5" />
          </div>
          {(pharmacy.name.toLowerCase().includes('24') || pharmacy.snippet?.toLowerCase().includes('24')) && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              Open 24/7
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-teal-700 transition-colors line-clamp-2">
          {pharmacy.name}
        </h3>
        
        <p className="text-slate-500 text-sm mb-3 line-clamp-3 leading-relaxed">
          {pharmacy.snippet}
        </p>

        {/* Opening Hours Section */}
        <div className="mb-4">
            {pharmacy.openingHours ? (
                <div className="flex gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <ClockIcon className="w-4 h-4 mt-0.5 shrink-0 text-teal-600" />
                    <span className="leading-snug">{pharmacy.openingHours}</span>
                </div>
            ) : (
                <button 
                  onClick={() => onCheckHours(pharmacy)}
                  disabled={isLoadingHours}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                    {isLoadingHours ? (
                         <LoaderIcon className="w-3 h-3 animate-spin" />
                    ) : (
                         <ClockIcon className="w-3 h-3" />
                    )}
                    {isLoadingHours ? 'Loading hours...' : 'View Opening Hours'}
                </button>
            )}
        </div>
      </div>

      <div className="relative z-10 space-y-3 pt-4 mt-auto border-t border-slate-100">
        <button 
          onClick={() => onCheckStock(pharmacy)}
          className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-sm font-medium rounded-xl transition-colors"
        >
          <BoxIcon className="w-4 h-4" />
          Check Medicine Stock
        </button>

        <div className="flex gap-2">
          <a 
            href={pharmacy.googleMapsUri} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <NavigationIcon className="w-4 h-4" />
            Navigate
          </a>
          <a 
            href={pharmacy.googleMapsUri} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            aria-label="View on Google Maps"
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default PharmacyCard;