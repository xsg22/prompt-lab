import React from 'react';
import { Button, Dropdown } from 'antd';

import {
    DownOutlined,
    ImportOutlined,
    ExportOutlined,
    FileAddOutlined
} from '@ant-design/icons';

interface DatasetActionsProps {
    onImportFromDataset: () => void;
    onExportToDataset: () => void;
    onImportFromJson: () => void;
    hasVariables: boolean;
    hasTestCases: boolean;
}

const DatasetActions: React.FC<DatasetActionsProps> = ({
    onImportFromDataset,
    onExportToDataset,
    onImportFromJson,
    hasVariables,
    hasTestCases
}) => {
    
    
    const menuItems = [
        {
            key: 'importJson',
            label: '从JSON导入',
            icon: <FileAddOutlined />,
            onClick: onImportFromJson,
            disabled: !hasVariables
        },
        {
            key: 'import',
            label: '从数据集导入',
            icon: <ImportOutlined />,
            onClick: onImportFromDataset,
            disabled: !hasVariables
        },
        {
            key: 'export',
            label: '导出到数据集',
            icon: <ExportOutlined />,
            onClick: onExportToDataset,
            disabled: !hasTestCases
        }
    ];

    return (
        <Dropdown
            trigger={['click']}
            menu={{ items: menuItems }}
        >
            <Button
                type="dashed"
                size="small"
            >
                {'导入导出'} <DownOutlined />
            </Button>
        </Dropdown>
    );
};

export default DatasetActions;
