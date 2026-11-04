// import KanbanBoard from "@/src/components/kanban/svar";
import KanbanBoard from "@/src/components/kanban/custom";
import { ExpandableModal, PopupModal } from "@/src/components/modals"
import DataRenderer from "@/src/components/render/pageDataRenderer"
import VehiclesManage from "@/src/components/render/vehicles";
import { DangerButton, OutlineButton, PrimaryButton, SecondaryButton } from "@/src/components/ui/buttons";
import { Input, Textarea } from "@/src/components/ui/inputs";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { Toggle } from "@/src/components/ui/toggle";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { randomString } from "@/src/services/other";
import { BuildingComplexIcon, GripHorizontalIcon, MailIcon, MapPinHouseIcon, PencilIcon, PhoneIcon, SquareTextIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";


// Sample data — replace with stages/items loaded from the backend
const sampleStages = [
    { id: 'new', name: 'New', description: 'Just came in' },
    { id: 'diagnosis', name: 'Diagnosis' },
    { id: 'in_repair', name: 'In Repair' },
    { id: 'ready', name: 'Ready for Pickup' },
];

const sampleItems = [
    { id: 1, title: 'Brake pad replacement', customer: 'John Smith', vehicle: 'Toyota Camry 2018', value: 320, stageId: 'new' },
    { id: 2, title: 'Oil change', customer: 'Anna Lee', vehicle: 'Honda Civic 2020', value: 80, stageId: 'new' },
    { id: 3, title: 'Check engine light', customer: 'Mark Davis', vehicle: 'Ford F-150 2016', value: 150, stageId: 'diagnosis' },
    { id: 4, title: 'Timing belt', customer: 'Sara Kim', vehicle: 'Subaru Outback 2015', value: 900, stageId: 'in_repair' },
    { id: 5, title: 'Tire rotation', customer: 'Paul Brown', vehicle: 'BMW X3 2021', value: 60, stageId: 'ready' },
];


function ThisEditComponent({
    isOpen = false, data = null, editType = 'new',
    onClose = () => { }, onInputChange = () => { }, onSubmit = () => { }
}) {


    const pipelineId = data?.id ?? 'tempId_' + randomString(20);
    if (data?.id === undefined) {
        data.id = pipelineId;
    }
    const formId = 'pipelineEditForm';
    const { t } = useTranslation();
    // const [_newStage, _setNewStage] = useState(null);
    const thisStageColumns = [{ id: pipelineId, name: 'Stages', description: '' }];
    const [_editItem, _setEditItem] = useState(null);

    const handleFormSubmit = (e) => {
        e?.preventDefault?.();

        let payload = { ...data };

        onSubmit(payload);
    };
    const handleCardMove = async ({ item, fromColumnId, toColumnId, fromIndex, toIndex }) => {
        logger.log('handleCardMove item:', item);
        logger.log('handleCardMove fromColumnId:', fromColumnId);
        logger.log('handleCardMove toColumnId:', toColumnId);
        logger.log('handleCardMove fromIndex:', fromIndex);
        logger.log('handleCardMove toIndex:', toIndex);
    };
    const getStageItems = () => {
        const arr = data?.stages ?? [];
        return arr.map((stage) => {
            return {
                ...stage,
                stageId: thisStageColumns[0].id,
            }
        });
    };
    const handleAddStage = () => {
        const s = {
            id: `tempId_${Date.now() + randomString(20)}`,
            name: 'New Stage ' + randomString(5),
            description: '',
            position: (data?.stages?.length ?? 0),
            pipelineId: pipelineId,
        };
        const newData = [...(data?.stages ?? []), s];
        onInputChange('stages', newData);
    };
    const handleDeleteStage = (stageId) => {
        const newData = (data?.stages ?? []).filter((stage) => stage.id !== stageId);
        onInputChange('stages', newData);
    };
    const handleStageInputChange = (stageId, field, value) => {
        // logger.log('handleStageInputChange stageId:', stageId, 'field:', field, 'value:', value);

        const newData = (data?.stages ?? []).map((stage) => {
            if (String(stage?.id) === String(stageId)) {
                return {
                    ...stage,
                    [field]: value,
                };
            }
            return stage;
        });

        logger.log('handleStageInputChange newData:', newData);
        onInputChange('stages', newData);
    };


    logger.log('ThisEditComponent data:', data);
    // logger.log('ThisEditComponent getStageItems:', getStageItems());

    return (
        <PopupModal isOpen={isOpen} onClose={onClose}>
            <div className="w-full flex flex-col gap-3 p-5">
                <form id={formId} className="flex flex-col gap-5" onSubmit={handleFormSubmit}>
                    <div className="w-full flex flex-col md:flex-row gap-2">
                        <div className="w-full flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <label className="font-semibold">{t('Name')}*</label>
                            </div>
                            <Input
                                type="text"
                                required={true}
                                name="name"
                                value={data?.name ?? ''}
                                onChange={(e) => onInputChange('name', e.target.value)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                        </div>
                        <div className="w-14 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <label className="font-semibold">{t('Active')}*</label>
                            </div>
                            <Toggle
                                checked={data?.active ?? true}
                                onChange={(checked) => onInputChange('active', checked)}
                            />
                        </div>

                    </div>
                </form>
                <div className="w-full py-5 flex flex-col gap-3">

                    <SecondaryButton
                        type="button"
                        onClick={handleAddStage}
                        className="w-full"
                    >
                        {t('Add Stage')}
                    </SecondaryButton>
                    <div className="">
                        <KanbanBoard
                            columns={thisStageColumns}
                            items={getStageItems()}
                            getColumnId={(item) => item.pipelineId}
                            colClassName="w-full"
                            // className=""
                            renderCard={(item) => {
                                // logger.log('renderCard item:', item);
                                const isEditing = _editItem?.id === item.id;

                                return (
                                    <div className="p-2 bg-white rounded-md shadow-sm flex items-center gap-4 border border-gray-200">
                                        <GripHorizontalIcon className="size-5 text-gray-400 mb-1" />
                                        <Input
                                            type="text"
                                            value={item.name ?? ''}
                                            // disabled={!isEditing}
                                            onChange={(e) => handleStageInputChange(item.id, 'name', e.target.value)}
                                        />
                                        {/* {isEditing
                                            ? <Input
                                                type="text"
                                                value={item.name ?? ''}
                                                disabled={!isEditing}
                                                onChange={(e) => handleStageInputChange(item.id, 'name', e.target.value)}
                                            />
                                            : <span className="">{item.name}</span>
                                        } */}
                                        {/* {!isEditing &&
                                            <div className="ml-auto flex gap-2">
                                                <SecondaryButton
                                                    type="button"
                                                    onClick={() => {
                                                        _setEditItem(item);
                                                    }}
                                                    className="ml-auto"
                                                >
                                                    <PencilIcon className="size-3" />
                                                </SecondaryButton>
                                                <DangerButton
                                                    type="button"
                                                    onClick={() => handleDeleteStage(item.id)}
                                                    className="ml-auto"
                                                >
                                                    <Trash2Icon className="size-3" />
                                                </DangerButton>
                                            </div>
                                        }
                                        {isEditing &&
                                            <div className="ml-auto flex gap-2">
                                                <SecondaryButton
                                                    type="button"
                                                    onClick={() => {
                                                        _setEditItem(null);
                                                    }}
                                                    className="ml-auto"
                                                >
                                                    <XIcon className="size-3" />
                                                </SecondaryButton>
                                                <PrimaryButton
                                                    type="button"
                                                    onClick={() => handleSaveStage(item.id)}
                                                    className="ml-auto"
                                                >
                                                    <CheckIcon className="size-3" />
                                                </PrimaryButton>
                                            </div>
                                        } */}
                                    </div>
                                )
                            }}
                            onMove={handleCardMove}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <PrimaryButton
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                        {t('Cancel')}
                    </PrimaryButton>
                    <PrimaryButton
                        type="submit"
                        form={formId}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                        {t('Save')}
                    </PrimaryButton>
                </div>

            </div >
        </PopupModal >
    );
}


export default function PipelinesPage() {
    const { t } = useTranslation();
    setMetas({
        title: 'Pipelines',
        description: 'Manage your pipelines',
    });

    return (
        <>

            <h1 className="text-2xl font-bold mb-4">
                {t('Pipelines')}
            </h1>
            <DataRenderer
                itsFor="pipelines"
                editComponent={ThisEditComponent}
                columns={[
                    {
                        name: 'active', label: 'Active', width: 80,
                        component: ({ row, value }) => {
                            return (
                                <div className="flex flex-wrap gap-2">
                                    {value ? (
                                        <div className={`size-4 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}>
                                        </div>
                                    ) : null}
                                </div>
                            )
                        }
                    },
                    { name: 'name', label: 'Name' },
                    {
                        name: 'stages', label: 'Stages', width: 400,
                        component: ({ row, value }) => {
                            // console.log('Stages component value:', value);

                            return (
                                <div className="flex flex-wrap gap-2">
                                    {value?.map((stage) => (
                                        <div key={stage.id} className="w-fit p-0.5 px-1 bg-blue-50 rounded-md border border-blue-200">
                                            <strong>{stage.name}</strong>
                                            {stage.description && <p className="text-sm">{stage.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    },
                ]}

            />

        </>
    )
}

