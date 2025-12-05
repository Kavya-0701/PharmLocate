import React from 'react';
import { PillIcon } from './Icons';

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-teal-500 p-2 rounded-xl text-white">
            <PillIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            PharmaLocate
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-slate-600">
          <span className="hover:text-teal-600 cursor-pointer transition-colors">Emergency</span>
          <span className="hover:text-teal-600 cursor-pointer transition-colors">24/7 Service</span>
          <span className="hover:text-teal-600 cursor-pointer transition-colors">About</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
