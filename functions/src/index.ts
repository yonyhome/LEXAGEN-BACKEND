import "./firebase"

import { confirmPayment } from "./routes/confirmPayment"
import { getTransactionStatus } from "./routes/getTransactionStatus"
import { processDocumentRequest } from "./routes/processDocumentRequest"
import {savePaymentOptionRest} from "./routes/savePaymentOptionRest"
import { testBucket } from "./routes/testBucket"

export {
    confirmPayment,
    getTransactionStatus,
    processDocumentRequest,
    savePaymentOptionRest,
    testBucket
}
