import AppBar from './AppBar';

interface Props {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
  /** Label tombol tambah; default `+ New {title}`. */
  addLabel?: string;
  /** Tampilkan tombol back; default true. */
  showBack?: boolean; 
}

export default function PageLayout({ 
  title, 
  onAdd, 
  children, 
  addLabel, 
  showBack = true 
}: Props) {
  return (
    <>
      <AppBar title={title} back={showBack} />
      
      <main className="page" style={{ paddingTop: 20 }}>
        {children}
      </main>

      <div className="dock">
        <button className="btn btn--primary btn--lg" onClick={onAdd}>
          {addLabel ?? `+ New ${title}`}
        </button>
      </div>
    </>
  );
}