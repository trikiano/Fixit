import { DataTypes } from 'sequelize';

export function defineSetting(sequelize) {
  return sequelize.define('Setting', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shop_name: { type: DataTypes.STRING, defaultValue: 'Fixit' },
    shop_phone: { type: DataTypes.STRING },
    shop_email: { type: DataTypes.STRING },
    shop_address: { type: DataTypes.TEXT },
    shop_logo: { type: DataTypes.STRING },
    currency: { type: DataTypes.STRING, defaultValue: 'EUR' },
    currency_symbol: { type: DataTypes.STRING, defaultValue: '€' },
    tax_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
    ticket_prefix: { type: DataTypes.STRING, defaultValue: 'TKT' },
    repair_prefix: { type: DataTypes.STRING, defaultValue: 'REP' },
    sale_prefix: { type: DataTypes.STRING, defaultValue: 'VTE' },
    sms_provider: { type: DataTypes.STRING },
    sms_api_key: { type: DataTypes.STRING },
    sms_api_secret: { type: DataTypes.STRING },
    sms_from: { type: DataTypes.STRING },
    sms_ticket_template: { type: DataTypes.TEXT },
    sms_repair_template: { type: DataTypes.TEXT },
    receipt_footer: { type: DataTypes.TEXT },
    low_stock_alert: { type: DataTypes.BOOLEAN, defaultValue: true },
    low_stock_threshold: { type: DataTypes.INTEGER, defaultValue: 5 },
    warranty_default_days: { type: DataTypes.INTEGER, defaultValue: 90 },
    loyalty_points_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
  }, { tableName: 'settings' });
}
