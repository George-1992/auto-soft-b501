import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { cloneDeep } from "lodash";
import { useTranslation } from "react-i18next";
import { logger } from "@/src/services/logger";
import { use } from "react";

const defaultHeadColors = [
    '#faf6de',
    '#f1e9be',
    '#f1e9be',
    '#dfeaf1',
    '#deebf7',
    '#e2f4f1',
    '#e6f7e9',
    '#f0f4ff',
    '#f9f0ff'
];

// Group a flat list of items into { [columnId]: item[] }
const groupItems = (columns, items, getColumnId) => {
    const grouped = {};
    columns.forEach(column => {
        grouped[String(column.id)] = [];
    });
    items.forEach(item => {
        const columnId = String(getColumnId(item));
        if (grouped[columnId]) grouped[columnId].push(item);
    });
    return grouped;
};

function DefaultCard({ item }) {
    return (
        <h4 className="font-semibold break-words">
            {item.title ?? item.name ?? item.id}
        </h4>
    );
}

/**
 * Generic drag & drop kanban board.
 *
 * columns       [{ id, name, description? }]
 * items         flat list of items; each item is placed in a column via getColumnId
 * getColumnId   item => column id (default: item.columnId)
 * renderCard    (item, { column, isDragging }) => node
 * onMove        async ({ item, fromColumnId, toColumnId, fromIndex, toIndex }) => boolean
 *               return false (or throw) to revert the move
 * headColors    background colors for column headers, cycled by index
 * countLabel    text shown after the item count in each column header
 */
export default function KanbanBoard({
    columns = [],
    items = [],
    getColumnId = (item) => { return item?.stageId ?? item?.columnId ?? item?.id ?? null; },
    renderCard = (item) => <DefaultCard item={item} />,
    onMove = async () => true,
    headColors = defaultHeadColors,
    countLabel = '',
    emptyText = 'No columns yet.',
    className = '',
    colClassName = '',
}) {
    const { t } = useTranslation();
    const [_grouped, _setGrouped] = useState(() => groupItems(columns, items, getColumnId));

    // Detect meaningful prop changes (including content edits like renamed stage).
    const safeSerialize = (value) => {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    };
    const syncKey = `${safeSerialize(columns)}::${safeSerialize(
        items.map((item) => ({ ...item, __columnId: getColumnId(item) }))
    )}`;

    const handleDragEnd = async (result) => {
        const { source, destination } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const fromColumnId = source.droppableId;
        const toColumnId = destination.droppableId;
        const previous = _grouped;

        // Update local state immediately for better UX
        const next = cloneDeep(_grouped);
        const [movedItem] = (next[fromColumnId] || []).splice(source.index, 1);
        if (!movedItem) return;
        if (!next[toColumnId]) next[toColumnId] = [];
        next[toColumnId].splice(destination.index, 0, movedItem);
        _setGrouped(next);

        // Then let the parent persist it; revert on failure
        try {
            const ok = await onMove({
                item: movedItem,
                fromColumnId,
                toColumnId,
                fromIndex: source.index,
                toIndex: destination.index,
            });
            if (ok === false) _setGrouped(previous);
        } catch (error) {
            logger.error('Error moving kanban item: ', error);
            _setGrouped(previous);
        }
    };

    useEffect(() => {
        _setGrouped(groupItems(columns, items, getColumnId));
    }, [syncKey]);

    if (!columns.length) {
        return <div className="text-center py-8 text-gray-500">{t(emptyText)}</div>;
    }

    // logger.log('KanbanBoard items:', items);

    return (
        <div className={`${className} w-full min-h-60 flex flex-col`}>
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex-1 flex gap-4 pb-4 overflow-x-auto items-stretch">
                    {columns.map((column, idx) => {
                        const columnId = String(column.id);
                        const columnItems = _grouped[columnId] || [];

                        return (
                            <Droppable key={columnId} droppableId={columnId}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`${colClassName} p-1 shrink-0 w-80 h-full rounded-md transition flex flex-col ${snapshot.isDraggingOver
                                            ? 'border-blue-500 bg-gray-200'
                                            : 'border-gray-200 bg-gray-100'
                                            }`}
                                    >
                                        {/* Column Header */}
                                        <div
                                            className="p-1 mb-1 rounded-md flex flex-col gap-1"
                                            style={{
                                                // backgroundColor: headColors[idx % headColors.length]
                                            }}
                                        >
                                            <div className="flex justify-between items-center gap-2">
                                                <h3 className="font-bold">{column.name}</h3>
                                                <p className="size-5 bg-gray-300/65 text-gray-600 flex justify-center items-center rounded-full shadow-sm">
                                                    {columnItems.length} {t(countLabel)}
                                                </p>
                                            </div>

                                            {column.description && (
                                                <p className="text-sm text-gray-600 mt-1">{column.description}</p>
                                            )}
                                        </div>

                                        {/* Items */}
                                        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                                            {columnItems.map((item, index) => (
                                                <Draggable
                                                    key={item.id}
                                                    draggableId={String(item.id)}
                                                    index={index}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`p-0 transition cursor-grab active:cursor-grabbing ${snapshot.isDragging
                                                                ? 'shadow-lg ring-2 ring-blue-400 opacity-50'
                                                                : 'hover:shadow-md'
                                                                }`}
                                                        >
                                                            {renderCard(item, { column, isDragging: snapshot.isDragging })}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        );
                    })}
                </div>
            </DragDropContext>
        </div>
    );
}
