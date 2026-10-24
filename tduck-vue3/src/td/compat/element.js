import ElementPlus, {ElMessage,ElMessageBox,ElNotification,ElLoading} from 'element-plus'
export {ElMessage as Message,ElMessageBox as MessageBox,ElNotification as Notification,ElLoading as Loading}
export default Object.assign({},ElementPlus,{Message:ElMessage,MessageBox:ElMessageBox,Loading:ElLoading,Notification:ElNotification})
