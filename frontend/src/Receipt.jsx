
function Receipt({ sale }) {
  if (!sale) return null;

  const formatMoney = (value) => {
    return Number(value).toFixed(2);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const hasCashPayment =
    sale.payment_method === "CASH" &&
    sale.cash_received != null &&
    sale.change_amount != null;

  return (
    <div className="receipt-print">

      {/* Store Information */}
      <div className="receipt-header">
        <h2>MINI RETAIL POS</h2>
        <p>SALES RECEIPT</p>
      </div>

      <div className="receipt-divider" />

      {/* Sale Information */}
      <div className="receipt-row">
        <span>Receipt No:</span>
        <span>#{sale.id}</span>
      </div>

      <div className="receipt-row">
        <span>Date:</span>
        <span>{formatDate(sale.created_at)}</span>
      </div>

      <div className="receipt-divider" />

      {/* Purchased Items */}
      <table className="receipt-items">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          {sale.items.map((item, index) => (
            <tr key={index}>
              <td>
                {item.product_name}
              </td>

              <td>{item.quantity}</td>

              <td>
                {formatMoney(item.unit_price)}
              </td>

              <td>
                {formatMoney(
                  Number(item.unit_price) * item.quantity
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-divider" />

      {/* Sale Total */}
      <div className="receipt-row receipt-total">
        <strong>TOTAL</strong>
        <strong>
          {formatMoney(sale.total_amount)}
        </strong>
      </div>

      <div className="receipt-divider" />

      {/* Payment Details */}
      {hasCashPayment ? (
        <>
          <div className="receipt-row">
            <span>Payment:</span>
            <span>Cash</span>
          </div>

          <div className="receipt-row">
            <span>Cash Received:</span>
            <span>
              {formatMoney(sale.cash_received)}
            </span>
          </div>

          <div className="receipt-row">
            <span>Change:</span>
            <span>
              {formatMoney(sale.change_amount)}
            </span>
          </div>
        </>
      ) : (
        <p>Payment details not recorded.</p>
      )}

      <div className="receipt-divider" />

      {/* Footer */}
      <div className="receipt-footer">
        <p>Thank you!</p>
        <p>Please visit again.</p>
      </div>

    </div>
  );
}

export default Receipt;
