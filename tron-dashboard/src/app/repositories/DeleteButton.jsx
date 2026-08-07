"use client";
import { deleteWorkflowAction } from './actions';

export default function DeleteButton({ workflowId }) {
    return (
        <form 
            action={deleteWorkflowAction} 
            className="mt-1"
            onSubmit={(e) => {
                if (!window.confirm('Are you sure you want to delete this mapping? This will stop automated updates.')) {
                    e.preventDefault();
                }
            }}
        >
            <input type="hidden" name="workflowId" value={workflowId} />
            <button type="submit" className="w-full text-center text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-lg text-sm font-bold transition-colors">
                Delete Mapping
            </button>
        </form>
    );
}