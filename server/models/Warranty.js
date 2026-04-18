import { DataTypes } from 'sequelize';

export function defineWarranty(sequelize) {
  return sequelize.define('Warranty', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    repair_id: { type: DataTypes.UUID },
    client_name: { type: DataTypes.STRING },
    client_phone: { type: DataTypes.STRING },
    device_brand: { type: DataTypes.STRING },
    device_model: { type: DataTypes.STRING },
    issue_description: { type: DataTypes.TEXT },
    resolution: { type: DataTypes.TEXT },
    start_date: { type: DataTypes.DATEONLY },
    end_date: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    notes: { type: DataTypes.TEXT },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  }, { tableName: 'warranties' });
}
