import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: true,
      createdAt: 'created_date',
      updatedAt: 'updated_date',
    },
  }
);

// Import all models
import { defineUser } from './User.js';
import { defineCashRegister } from './CashRegister.js';
import { defineClient } from './Client.js';

import { defineProduct } from './Product.js';
import { defineRepair } from './Repair.js';
import { defineSale } from './Sale.js';
import { defineStockMovement } from './StockMovement.js';
import { defineSupplier } from './Supplier.js';
import { defineSupplierInvoice } from './SupplierInvoice.js';
import { definePurchaseOrder } from './PurchaseOrder.js';
import { defineExpense } from './Expense.js';
import { defineWarranty } from './Warranty.js';
import { definePromotion } from './Promotion.js';
import { defineServiceSale } from './ServiceSale.js';
import { defineServiceItem } from './ServiceItem.js';
import { defineServiceCategory } from './ServiceCategory.js';
import { definePrepaidCard } from './PrepaidCard.js';
import { defineCardTopup } from './CardTopup.js';
import { defineAuditLog } from './AuditLog.js';
import { defineNotification } from './Notification.js';
import { defineNotificationLog } from './NotificationLog.js';
import { defineSetting } from './Setting.js';

import { defineBrand } from './Brand.js';
import { defineDeviceType } from './DeviceType.js';
import { defineDeviceModel } from './DeviceModel.js';
import { defineProductCategory } from './ProductCategory.js';

const User = defineUser(sequelize);
const CashRegister = defineCashRegister(sequelize);
const Client = defineClient(sequelize);

const Product = defineProduct(sequelize);
const Repair = defineRepair(sequelize);
const Sale = defineSale(sequelize);
const StockMovement = defineStockMovement(sequelize);
const Supplier = defineSupplier(sequelize);
const SupplierInvoice = defineSupplierInvoice(sequelize);
const PurchaseOrder = definePurchaseOrder(sequelize);
const Expense = defineExpense(sequelize);
const Warranty = defineWarranty(sequelize);
const Promotion = definePromotion(sequelize);
const ServiceSale = defineServiceSale(sequelize);
const ServiceItem = defineServiceItem(sequelize);
const ServiceCategory = defineServiceCategory(sequelize);
const PrepaidCard = definePrepaidCard(sequelize);
const CardTopup = defineCardTopup(sequelize);
const AuditLog = defineAuditLog(sequelize);
const Notification = defineNotification(sequelize);
const NotificationLog = defineNotificationLog(sequelize);
const Setting = defineSetting(sequelize);

const Brand = defineBrand(sequelize);
const DeviceType = defineDeviceType(sequelize);
const DeviceModel = defineDeviceModel(sequelize);
const ProductCategory = defineProductCategory(sequelize);

export {
  sequelize,
  User, CashRegister, Client, Product, Repair, Sale, StockMovement,

  Supplier, SupplierInvoice, PurchaseOrder, Expense,
  Warranty, Promotion, ServiceSale, ServiceItem, ServiceCategory,
  PrepaidCard, CardTopup, AuditLog, Notification, NotificationLog, Setting,
  Brand, DeviceType, DeviceModel, ProductCategory,

};
