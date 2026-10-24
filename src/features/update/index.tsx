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
        cancelText={readyToInstall ? 'Mai târziu' : 'Anulează'}
        okText={readyToInstall ? 'Instalează acum' : 'Descarcă actualizarea'}
        onCancel={closeModal}
        onOk={() => void confirmAction()}
        footer={updateAvailable ? null : undefined}
      >
        <div className='modal-slot'>
          {updateError ? (
            <div>
              <p>Eroare la verificarea sau descărcarea actualizării.</p>
              <p>{updateError.message}</p>
            </div>
          ) : updateAvailable ? (
            <div>
              <div>Este disponibilă versiunea v{versionInfo?.newVersion}.</div>
              <div className='new-version__target'>v{versionInfo?.version} -&gt; v{versionInfo?.newVersion}</div>
              <div className='update__progress'>
                <div className='progress__title'>Progres:</div>
                <div className='progress__bar'>
                  <Progress percent={progressInfo?.percent} />
                </div>
              </div>
            </div>
          ) : (
            <div className='can-not-available'>Aplicația este actualizată. Versiunea instalată: v{versionInfo?.version ?? '—'}.</div>
          )}
        </div>
      </Modal>
      <button className="update-check-button" type="button" disabled={checking} onClick={() => void checkForUpdates()}>
        {checking ? 'Se verifică...' : 'Verifică actualizări'}
      </button>
    </>
  )
}

export default UpdateFeature
