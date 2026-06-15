import { DataTypes } from 'sequelize';

export function defineInvoice(sequelize) {
  return sequelize.define('Invoice', {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shop_id:        { type: DataTypes.UUID, allowNull: true },
    invoice_number: { type: DataTypes.STRING },          // ex: FAC-000001
    client_id:      { type: DataTypes.UUID, allowNull: true },
    client_name:    { type: DataTypes.STRING },
    client_address: { type: DataTypes.TEXT },
    client_phone:   { type: DataTypes.STRING },
    client_email:   { type: DataTypes.STRING },
    client_tax_id:  { type: DataTypes.STRING },          // MF / ICE / RNE
    date:           { type: DataTypes.DATEONLY },
    due_date:       { type: DataTypes.DATEONLY, allowNull: true },
    status:         { type: DataTypes.STRING, defaultValue: 'brouillon' }, // brouillon|envoyee|payee|annulee
    items:          { type: DataTypes.JSON, defaultValue: [] },
    /*
      items: [{
        description, quantity, unit_price, tax_rate,
        subtotal_ht, tax_amount, subtotal_ttc
      }]
    */
    subtotal_ht:    { type: DataTypes.FLOAT, defaultValue: 0 },
    tax_amount:     { type: DataTypes.FLOAT, defaultValue: 0 },
    total_ttc:      { type: DataTypes.FLOAT, defaultValue: 0 },
    notes:          { type: DataTypes.TEXT },
    payment_method: { type: DataTypes.STRING },          // espèces|virement|chèque|carte
    footer_text:    { type: DataTypes.TEXT },
  }, { tableName: 'invoices' });
}
