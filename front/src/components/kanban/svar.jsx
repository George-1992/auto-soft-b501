import { useState } from 'react';
import { Kanban, Editor } from '@svar-ui/react-kanban';
import '@svar-ui/react-kanban/all.css';

const columns = [
    { id: 'backlog', label: 'Backlog' },
    { id: 'inprogress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
];

const initialCards = [
    { id: 1, label: 'Design landing page', column: 'backlog', priority: 'high' },
    { id: 2, label: 'Set up CI pipeline', column: 'inprogress', priority: 'medium' },
    { id: 3, label: 'Write API docs', column: 'done', priority: 'low' },
];

function CustomCard({ card }) {
    const priorityColor = {
        high: '#ff4d4f',
        medium: '#faad14',
        low: '#52c41a',
    }[card.priority] || '#d9d9d9';

    return (
        <div className='w-40 h-40 bg-red-200'>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{card.label}</div>
            {card.priority && (
                <span style={{ fontSize: '11px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: priorityColor, color: '#fff' }}>
                    {card.priority}
                </span>
            )}
        </div>
    );
}


export default function KanbanBoard() {
    const [api, setApi] = useState(null);

    return (
        <>
            <Kanban
                init={setApi}
                cards={initialCards}
                columns={columns}
                cardContent={CustomCard}
            />
            {api && <Editor api={api} />}
        </>
    );
}