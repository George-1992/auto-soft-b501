import Table from "@/src/components/table/index.jsx";
import { LoaderEl, LoaderShimmer } from "@/src/components/ui/loader";
import ToasterSonnar, { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import _ from "lodash";
import { use, useEffect } from "react";
import { useState } from "react";



export default function Notes() {


    const [_data, _setData] = useState([]);
    const [_isLoading, _setIsLoading] = useState(true);
    const [_page, _setPage] = useState({
        page: 1,
        perPage: 10,
        total: 0,
    });


    useEffect(() => {
        const fetchData = async () => {
            const res = await sendBackRequest({
                itsFor: 'notes',
                action: 'get',
                method: 'POST',
                data: {
                    offset: (_page.page - 1) * _page.perPage,
                    limit: _page.perPage,
                }
            });

            // logger.info('fetchData response:', res);
            _setData(res.data || []);
            _setIsLoading(false);
            _setPage(prev => ({
                ...prev,
                total: res.total || 0,
            }));
        };
        fetchData();
        // logger.info('Notes page loaded');
        // notify({ type: 'info', message: 'Notes page loaded', timer: 3000 });
    }, []);



    const handlePageChange = (newPage) => {
        logger.info('handlePageChange:', newPage);
    }
    const handleNewItemClick = async (data) => {
        const response = await sendBackRequest({
            itsFor: 'notes',
            action: 'create',
            method: 'POST',
            data: data,
        });
        logger.info('handleNewItemClick response:', response);
        const newData = response.data ? [...response.data, ..._data] : _data;
        logger.info('handleNewItemClick: newData:', newData);
        _setData(newData);

        return response;
    };

    const onBulkAction = (action, selectedItems) => {
        logger.info('onBulkAction:', action, selectedItems);
    }
    const handleEditSubmit = (item) => {
        logger.info('handleEditSubmit:', item);
    }
    const handleDeleteSubmit = (item) => {
        logger.info('handleDeleteSubmit:', item);
    }
    const handlePreview = (item) => {
        logger.info('handlePreview:', item);
    }


    const updateItem = async ({ item, action }) => {
        logger.info('updateItem:', item, action);
        const response = await sendBackRequest({
            itsFor: 'notes',
            action: 'update',
            method: 'POST',
            data: { ...item, action },
        });
        const newData = response.data ? [...response.data, ..._data] : _data;
        _setData(newData);
        return response;
    }


    return (
        <div className="relative rounded">
            <LoaderShimmer className={""} isLoading={_isLoading} />
            <Table
                className=""
                editable={true}
                sortable={true}
                paginated={true}
                page={_page}
                onPageChange={handlePageChange}
                previewKey=""
                data={_data}
                onAddNew={handleNewItemClick}
                onRowChange={(item) => updateItem({ item, action: 'update' })}
                onRowDelete={(item) => updateItem({ item, action: 'delete' })}
                onBulkAction={onBulkAction}
                actions={['edit', 'delete']}
                // actions={[
                //     {
                //         name: 'edit',
                //         onlyCallback: true,
                //         func: handleEditSubmit
                //     },
                //     {
                //         name: 'delete',
                //         confirm: {
                //             title: 'Confirm Deletion',
                //             message: 'Are you sure you want to delete this job?',
                //             button1: 'Cancel',
                //             button2: 'Delete',
                //         },
                //         func: (item) => updateItem({ item, action: 'delete' })
                //     }
                // ]}
                columns={[
                    {
                        key: 'title',
                        title: 'Title',
                        width: 'w-64',
                        required: true,
                        validateKey: 'length',
                    },
                    {
                        key: 'content',
                        title: 'Content',
                        width: 'w-96',
                        type: 'textarea',
                        Component: (props) => {
                            if (!props.value) return <span className="text-gray-400">No content</span>;
                            const truncated = props.value.length > 100 ? props.value.substring(0, 100) + '...' : props.value;
                            return <span className="text-sm text-gray-700">{truncated}</span>;
                        }
                    }
                ]}
            />
        </div>
    );
}