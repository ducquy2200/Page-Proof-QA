import sqlalchemy as sa

try:
    from pgvector.sqlalchemy import Vector as Vector
except ImportError:
    class Vector(sa.types.UserDefinedType):
        cache_ok = True

        def __init__(self, dim: int) -> None:
            self.dim = dim

        def get_col_spec(self, **_: object) -> str:
            return f"vector({self.dim})"

