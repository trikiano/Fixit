import { DataTypes } from 'sequelize';

export function defineRepair(sequelize) {
  return sequelize.define('Repair', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ticket_number: { type: DataTypes.STRING },
    client_id: { type: DataTypes.UUID },
    client_name: { type: DataTypes.STRING },
    client_phone: { type: DataTypes.STRING },
    client_email: { type: DataTypes.STRING },
    device_type: { type: DataTypes.STRING },
    device_brand: { type: DataTypes.STRING },
    device_model: { type: DataTypes.STRING },
    device_serial: { type: DataTypes.STRING },
    device_color: { type: DataTypes.STRING },
    issue_description: { type: DataTypes.TEXT },
    diagnosis: { type: DataTypes.TEXT },
    technician_notes: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'recu' },
    priority: { type: DataTypes.STRING, defaultValue: 'normal' },
    estimated_cost: { type: DataTypes.FLOAT },
    final_cost: { type: DataTypes.FLOAT },
    deposit: { type: DataTypes.FLOAT, defaultValue: 0 },
    payment_method: { type: DataTypes.STRING },
    payments: { type: DataTypes.JSON, defaultValue: [] },
    parts_used: { type: DataTypes.JSON, defaultValue: [] },
    assigned_to: { type: DataTypes.STRING },
    accessories: { type: DataTypes.STRING },
    warranty_days: { type: DataTypes.INTEGER, defaultValue: 0 },
    warranty_expires: { type: DataTypes.DATE },
    completed_date: { type: DataTypes.DATE },
    estimated_date: { type: DataTypes.DATE },
    notified: { type: DataTypes.BOOLEAN, defaultValue: false },

    pin_code: { type: DataTypes.STRING },
    images: { type: DataTypes.JSON, defaultValue: [] },
  }, { tableName: 'repairs' });
}
