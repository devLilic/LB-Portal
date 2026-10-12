import Modal from './components/Modal'
import Progress from './components/Progress'
import { useUpdateState } from './useUpdateState'
import './update.css'

const UpdateFeature = () => {
  const {
    checking,
    modalOpen,
    readyToInstall,
    updateAvailable,
    versionInfo,
    updateError,
    progressInfo,
    checkForUpdates,
    closeModal,
    confirmAction,
  } = useUpdateState()

  return (
    <>
      <Modal
        open={modalOpen}
        cancelText={readyToInstall ? 'Later' : 'Cancel'}
        okText={readyToInstall ? 'Install now' : 'Update'}
        onCancel={closeModal}
        onOk={() => void confirmAction()}
        footer={updateAvailable ? null : undefined}
      >
        <div className='modal-slot'>
          {updateError ? (
            <div>
              <p>Error downloading the latest version.</p>
              <p>{updateError.message}</p>
            </div>
          ) : updateAvailable ? (
            <div>
              <div>The last version is: v{versionInfo?.newVersion}</div>
              <div className='new-version__target'>v{versionInfo?.version} -&gt; v{versionInfo?.newVersion}</div>
              <div className='update__progress'>
                <div className='progress__title'>Update progress:</div>
                <div className='progress__bar'>
                  <Progress percent={progressInfo?.percent} />
                </div>
              </div>
            </div>
          ) : (
            <div className='can-not-available'>{JSON.stringify(versionInfo ?? {}, null, 2)}</div>
          )}
        </div>
      </Modal>
      <button disabled={checking} onClick={() => void checkForUpdates()}>
        {checking ? 'Checking...' : 'Check update'}
      </button>
    </>
  )
}

export default UpdateFeature
