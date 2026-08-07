"use client";
import { useState } from 'react';
import { deleteWorkflowAction } from './actions';

export default function DeleteButton({ workflowId }) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            {/* The initial trigger button */}
            <button 
                type="button" 
                onClick={() => setShowModal(true)}
                className="w-full text-center text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-lg text-sm font-bold transition-colors mt-1"
            >
                Delete Mapping
            </button>

            {/* The Custom Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-red-50 text-red-600 rounded-full shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Delete Mapping?</h3>
                        </div>
                        
                        <p className="text-sm text-gray-500 mb-6 pl-1">
                            Are you sure you want to delete this mapping? This will immediately stop all automated updates and broadcasts for this repository.
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            
                            {/* The actual server action form is moved inside the modal */}
                            <form action={deleteWorkflowAction} className="flex-1">
                                <input type="hidden" name="workflowId" value={workflowId} />
                                <button 
                                    type="submit" 
                                    className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm text-sm"
                                >
                                    Yes, Delete
                                </button>
                            </form>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
}